(function () {
  "use strict";
  if (window.__sourcepickRedirecting) return;

  let core = window.SourceCore;
  let store = window.SourceStore;
  let i18n = window.SourceI18n;
  let t = i18n.t;
  let LANG = i18n.lensLang;
  // The elements of index.html that are not plain HTMLElement; every other id is an HTMLElement.
  interface ElementTypes {
    q: HTMLInputElement;
    "add-site": HTMLInputElement;
    "save-lens-name": HTMLInputElement;
    forums: HTMLInputElement;
    multi: HTMLInputElement;
    "edit-id": HTMLInputElement;
    "new-name": HTMLInputElement;
    "import-link": HTMLInputElement;
    "new-sites": HTMLTextAreaElement;
    "new-lens-form": HTMLFormElement;
  }
  type ById<K extends string> = K extends keyof ElementTypes ? ElementTypes[K] : HTMLElement;
  let $ = function <K extends string>(id: K): ById<K> { return document.getElementById(id) as ById<K>; };
  let isPopup = document.body.classList.contains("popup");
  let isExt = store.isExtension;

  let state: State;
  let pendingImport: SharedLens | null = null;
  let badImport = false;
  let routed = false;

  // ---------- helpers ----------
  // Attributes: "text", "class", "on<event>" handlers, and anything else as an attribute.
  type Handler = (e: MouseEvent) => void;
  type Attrs = Record<string, string | boolean | Handler | null | undefined>;

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, children?: (HTMLElement | null)[]): HTMLElementTagNameMap[K] {
    let n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      let v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "text") n.textContent = v as string;
      else if (k === "class") n.className = v as string;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v as EventListener);
      else n.setAttribute(k, v === true ? "" : (v as string));
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function lenses() { return store.allLenses(state); }
  function byId(id: string) { return lenses().filter(function (l) { return l.id === id; })[0]; }
  function name(l: { id?: string; name?: string | LocalizedName }): string { return core.lensName(l, LANG); }
  function shownLenses(mode?: LensMode) {
    return state.shown.map(byId).filter(function (l) { return l && (!mode || l.mode === mode); });
  }

  function persist() { return store.save(state); }

  function savedMatches() {
    persist();
    let saved = store.readLocal();
    let a = core.collect(lenses(), saved.active, saved.off, saved.extra), c = current();
    return JSON.stringify([a.include, a.exclude, saved.engine, saved.period, saved.forums]) ===
      JSON.stringify([c.include, c.exclude, state.engine, state.period, state.forums]);
  }

  function current() { return core.collect(lenses(), state.active, state.off, state.extra); }

  function opts() {
    return { engine: state.engine, period: state.period, forums: state.engine === "google" && state.forums };
  }

  function showMsg(id: string, msg?: string): void {
    let n = $(id);
    n.textContent = msg || "";
    n.hidden = !msg;
  }

  let flashTimers: Record<string, number> = {};

  function flash(id: string, msg: string): void {
    showMsg(id, msg);
    clearTimeout(flashTimers[id]);
    flashTimers[id] = setTimeout(function () { showMsg(id, ""); }, 2500);
  }

  function siteLabel(domain: string): string {
    let found: string | null = null;
    lenses().some(function (l) {
      return l.sites.some(function (s) { if (s.domain === domain && s.name) { found = s.name; return true; } return false; });
    });
    return found || domain;
  }

  function openUrl(url: string): void {
    if (isExt && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: url });
      if (isPopup) window.close();
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  // ---------- main view ----------
  function renderGrid() {
    let box = $("lens-grid");
    box.textContent = "";
    shownLenses("include").forEach(function (l) {
      let on = state.active.indexOf(l.id) >= 0;
      box.appendChild(el("button", {
        type: "button",
        class: "lens-btn" + (on ? " is-on" : ""),
        "aria-pressed": on ? "true" : "false",
        title: t("tileTitle", l.sites.length),
        onclick: function (e) { pick(l.id, e.ctrlKey || e.metaKey || e.shiftKey); },
      }, [el("span", { class: "lens-name", text: name(l) })]));
    });
    if (!box.children.length) box.appendChild(el("p", { class: "desc", text: t("noShown") }));
    box.appendChild(el("a", { href: "#new", class: "lens-btn lens-add", onclick: openNew }, [el("span", { class: "lens-name", text: t("newLensTile") })]));
  }

  // A tap chooses that source alone, like a tab; tapping it again searches the whole web.
  // With "choose several" on (or Ctrl, Cmd or Shift held) taps add and remove sources instead.
  function pick(id: string, add: boolean): void {
    let includes = state.active.filter(function (x) { let l = byId(x); return l && l.mode === "include"; });
    let on = state.active.indexOf(id) >= 0;
    if (add || state.multi) {
      if (on) state.active.splice(state.active.indexOf(id), 1);
      else state.active.push(id);
    } else {
      state.active = state.active.filter(function (x) { return includes.indexOf(x) < 0; });
      if (!(on && includes.length === 1)) state.active.push(id);
      // Sites that were in the results page's query but in no source go too, so the tab searches
      // only the chosen source (they would otherwise stay added and be saved as extra sites).
      if (pageExtra.length) {
        state.extra = state.extra.filter(function (d) { return pageExtra.indexOf(d) < 0; });
        pageExtra = [];
      }
    }
    persist();
    renderMain();
    applyTab();
  }

  function toggleActive(id: string): void { pick(id, true); }

  // ---------- current tab (extension popup) ----------
  // Opened over a Google, Bing, DuckDuckGo or Brave results page, the popup works on that page: the
  // search box holds its words, the buttons show its sources, and changes search that tab again.
  interface Tab { id: number; engine: EngineId; keep: URLSearchParams }
  let tab: Tab | null = null;
  let pageExtra: string[] = [];

  function connectTab(done: () => void): void {
    if (!isPopup || !chrome.tabs || !chrome.tabs.query) { done(); return; }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      let cur = !chrome.runtime.lastError && tabs && tabs[0];
      if (!cur || cur.id === undefined) { done(); return; }
      let tabId = cur.id;
      chrome.tabs.sendMessage(tabId, { type: "sourcepick:page" }, function (r: { engine: EngineId; query?: string; search?: string } | undefined) {
        if (chrome.runtime.lastError || !r || !core.ENGINES[r.engine]) { done(); return; }
        tab = { id: tabId, engine: r.engine, keep: new URLSearchParams(r.search || "") };
        mirrorPage(tab, r.query || "");
        done();
      });
    });
  }

  function mirrorPage(tab: Tab, q: string): void {
    let eng = core.ENGINES[tab.engine];
    let f = core.parseFilters(q);
    let covered: string[] = [];
    state.engine = tab.engine;
    state.period = core.periodKey(tab.engine, tab.keep.get(eng.period.param));
    if (eng.forums) state.forums = tab.keep.get(eng.forums.param) === eng.forums.value;
    state.active = shownLenses().filter(function (l) {
      let on = core.lensState(q, l, tab.engine) !== "none";
      if (on) covered = covered.concat(core.lensDomains(l));
      return on;
    }).map(function (l) { return l.id; });
    state.off = [];
    state.extra = f.include.filter(function (d) { return covered.indexOf(d) < 0; });
    pageExtra = state.extra.slice();
    $("q").value = core.stripFilters(q);
    let note = $("tab-note");
    note.textContent = t("tabNote", eng.name);
    note.hidden = false;
  }

  function applyTab(): boolean {
    if (!tab) return false;
    let q = $("q").value.trim();
    if (!q) return false;
    let c = current();
    let url = core.searchUrl(q, c.include, c.exclude, {
      engine: state.engine, period: state.period, forums: opts().forums,
      keepFrom: state.engine === tab.engine ? tab.keep : null,
    });
    chrome.tabs.update(tab.id, { url: url });
    tab.engine = state.engine;
    tab.keep = new URL(url).searchParams;
    $("tab-note").textContent = t("tabNote", core.ENGINES[state.engine].name);
    return true;
  }

  function openNew(e: MouseEvent): void {
    if (isPopup) {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("index.html#new") });
      window.close();
    }
  }

  function renderSummary() {
    let c = current();
    let n = c.include.length;
    $("site-count").textContent = n ? t("siteCount", n) : t("siteCountNone");
    $("clear").hidden = !state.active.length && !state.extra.length;
    $("multi").checked = state.multi;
    renderLimit();
  }

  // Search engines ignore words past their limit without saying so; tell the user what is left out.
  function renderLimit() {
    let c = current();
    let f = core.fit($("q").value, c.include, c.exclude, state.engine);
    let eng = core.ENGINES[state.engine].name;
    let msg = "";
    let by: "" | "Length" = f.byLength ? "Length" : "";
    if (f.cut.include.length) msg = t(`limitInclude${by}`, eng, f.limit, c.include.length, f.include.length);
    else if (f.cut.exclude.length) msg = t(`limitExclude${by}`, eng, f.limit, f.cut.exclude.length);
    showMsg("limit-note", msg);
  }

  function renderEditor() {
    let box = $("site-list");
    box.textContent = "";
    let active = state.active.map(byId).filter(function (l) { return l && l.mode === "include"; });
    if (!active.length && !state.extra.length) box.appendChild(el("p", { class: "desc", text: t("editorEmpty") }));
    active.forEach(function (l) {
      let ul = el("ul", { class: "site-rows" });
      l.sites.forEach(function (s) {
        let input = el("input", { type: "checkbox", "data-domain": s.domain });
        input.checked = state.off.indexOf(s.domain) < 0;
        input.addEventListener("change", function () { toggleOff(s.domain, !input.checked); });
        ul.appendChild(el("li", null, [el("label", { class: "site-row" }, [
          input, el("span", { class: "site-name", text: s.name || s.domain }), s.name ? el("span", { class: "site-domain", text: s.domain }) : null,
        ])]));
      });
      let on = l.sites.filter(function (s) { return state.off.indexOf(s.domain) < 0; }).length;
      let head = el("div", { class: "list-head" }, [
        el("h3", { text: name(l) }),
        el("span", { class: "list-count", text: on + "/" + l.sites.length }),
        on < l.sites.length ? el("button", { type: "button", class: "btn-text", text: t("selectAll"), onclick: function () { turnOnAll(l); } }) : null,
      ]);
      box.appendChild(el("div", { class: "list-group" }, [head, ul]));
    });
    if (state.extra.length) {
      let ul2 = el("ul", { class: "site-rows" });
      state.extra.forEach(function (d) {
        ul2.appendChild(el("li", { class: "site-row" }, [
          el("span", { class: "site-name", text: d }),
          el("button", { type: "button", class: "btn-text danger", text: t("delete"), "aria-label": t("deleteSite", d), onclick: function () { removeExtra(d); } }),
        ]));
      });
      box.appendChild(el("div", { class: "list-group" }, [el("h3", { class: "list-head", text: t("addedSites") }), ul2]));
    }
  }

  function toggleOff(domain: string, off: boolean): void {
    let i = state.off.indexOf(domain);
    if (off && i < 0) state.off.push(domain);
    if (!off && i >= 0) state.off.splice(i, 1);
    persist();
    renderEditor(); renderSummary(); renderPerSite();
    // Redrawing the list drops focus; put it back on the same box for keyboard users.
    let box = document.querySelector<HTMLInputElement>('#site-list input[data-domain="' + domain + '"]');
    if (box) box.focus({ preventScroll: true });
  }

  function turnOnAll(l: Lens): void {
    let ds = core.lensDomains(l);
    state.off = state.off.filter(function (d) { return ds.indexOf(d) < 0; });
    persist();
    renderEditor(); renderSummary(); renderPerSite();
  }

  // Shares the sites in use right now as one source; the person who opens the link can add it.
  function shareSelection() {
    let c = current();
    if (!c.include.length) { showMsg("share-done", t("needSites")); return; }
    let picked = state.active.map(byId).filter(function (l) { return l && l.mode === "include"; }).map(name);
    let nm = $("save-lens-name").value.trim() || picked.join(", ").slice(0, 30) || t("addedSites");
    let url = shareUrl({ name: nm, mode: "include", sites: c.include.map(function (d) { return { domain: d }; }) });
    if (navigator.share && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      navigator.share({ title: nm, url: url }).catch(function () { /* closed the share sheet */ });
      return;
    }
    copyText(url, function () { flash("share-done", t("selectionCopied")); });
  }

  function removeExtra(d: string): void {
    state.extra = state.extra.filter(function (x) { return x !== d; });
    persist();
    renderMain();
  }

  function renderSegmented(boxId: string, items: string[][], value: string, onPick: (v: string) => void): void {
    let box = $(boxId);
    Array.prototype.slice.call(box.querySelectorAll("label")).forEach(function (n) { n.remove(); });
    items.forEach(function (it) {
      let input = el("input", { type: "radio", name: boxId, value: it[0] });
      input.checked = value === it[0];
      input.addEventListener("change", function () { onPick(it[0]); });
      box.appendChild(el("label", { class: "seg" }, [input, el("span", { text: it[1] })]));
    });
  }

  function renderOptions() {
    renderSegmented("period", core.PERIODS.map(function (p) { return [p, t(`period_${p || "all"}`)]; }), state.period, function (v) {
      state.period = v as Period; persist(); renderOptions(); renderPerSite(); applyTab();
    });
    let box = $("exclude-list");
    box.textContent = "";
    if (shownLenses("exclude").length) {
      box.appendChild(el("h3", { class: "sub-head", text: t("excludeHead") }));
      box.appendChild(el("p", { class: "desc tight", text: t("excludeDesc") }));
    }
    shownLenses("exclude").forEach(function (l) {
      let input = el("input", { type: "checkbox" });
      input.checked = state.active.indexOf(l.id) >= 0;
      input.addEventListener("change", function () { toggleActive(l.id); });
      box.appendChild(el("label", { class: "check" }, [input, el("span", { text: name(l) })]));
    });
    $("forums-row").hidden = state.engine !== "google";
    $("forums").checked = state.forums;
    $("multi").checked = state.multi;
    // Google is the default; the summary names the engine only when someone picked another one.
    let bits = state.engine === "google" ? [] : [core.ENGINES[state.engine].name];
    bits.push(t(`period_${state.period || "all"}`));
    if (state.engine === "google" && state.forums) bits.push(t("forumsShort"));
    let ex = shownLenses("exclude").filter(function (l) { return state.active.indexOf(l.id) >= 0; }).length;
    if (ex) bits.push(t("excludeShort", ex));
    $("opt-summary").textContent = bits.join(", ");
  }

  function renderPerSite() {
    let q = $("q").value.trim();
    let c = current();
    let sec = $("per-site");
    let ul = $("per-site-list");
    ul.textContent = "";
    if (!q || c.include.length < 2) { sec.hidden = true; return; }
    sec.hidden = false;
    let labels = c.include.map(siteLabel);
    c.include.forEach(function (d, i) {
      // Two sites with the same name (Naver blog and Naver cafe paths, for example) show the domain.
      let text = labels.indexOf(labels[i]) !== labels.lastIndexOf(labels[i]) ? d : labels[i];
      ul.appendChild(el("li", null, [el("a", {
        class: "chip", href: core.searchUrl(q, [d], c.exclude, opts()), target: "_blank", rel: "noopener", title: d,
        onclick: function (e) { if (isExt) { e.preventDefault(); openUrl((e.currentTarget as HTMLAnchorElement).href); } },
      }, [el("span", { text: text })])]));
    });
  }

  // Address-bar URL. Without lens params the redirect page uses whatever is selected on this
  // screen at the time of the search, so changing sources here also changes address-bar searches.
  function engineUrl() {
    return location.origin + location.pathname.replace(/index\.html$/, "") + "?q=%s";
  }

  function renderMain() {
    renderGrid();
    renderSummary();
    renderEditor();
    renderOptions();
    renderPerSite();
  }

  // ---------- manage view ----------
  let REGION_ORDER: ("custom" | "kr" | "jp" | "global")[] = ["custom", "kr", "jp", "global"];
  let HOME_REGION = { ko: "kr", ja: "jp", en: "global" }[LANG];
  let openRegions: Record<string, boolean> = {};

  // Other engines live in Manage so the main screen stays on Google for most people.
  function renderEngine() {
    renderSegmented("engine", Object.keys(core.ENGINES).map(function (k) { return [k, core.ENGINES[k].name]; }), state.engine, function (v) {
      state.engine = v as EngineId; persist(); renderEngine(); renderOptions(); renderPerSite(); renderLimit(); applyTab();
    });
  }

  // Exclude sources say so in Manage unless their name already does ("No news" or "언론사 제외").
  function manageTitle(l: Lens): string {
    let title = name(l);
    if (l.mode === "exclude" && title.toLowerCase().indexOf(t("modeExcludeShort").toLowerCase()) < 0) title += " (" + t("modeExcludeShort") + ")";
    return title;
  }

  // The order of the buttons on the main screen and on results pages; the exclude sources keep their
  // own order under Search options, so they are listed after the others.
  function renderOrder(focusId?: string, dir?: number) {
    let box = $("order-list");
    box.textContent = "";
    let list = shownLenses("include").concat(shownLenses("exclude"));
    list.forEach(function (l, i) {
      let title = manageTitle(l);
      let up = el("button", { type: "button", class: "btn-icon", "aria-label": t("moveUp", title), title: t("moveUp", title), "data-id": l.id, "data-dir": "-1", text: "\u2191", onclick: function () { move(l.id, -1); } });
      let down = el("button", { type: "button", class: "btn-icon", "aria-label": t("moveDown", title), title: t("moveDown", title), "data-id": l.id, "data-dir": "1", text: "\u2193", onclick: function () { move(l.id, 1); } });
      if (i === 0 || (l.mode === "exclude" && list[i - 1].mode !== "exclude")) up.disabled = true;
      if (i === list.length - 1 || (l.mode !== "exclude" && list[i + 1].mode === "exclude")) down.disabled = true;
      box.appendChild(el("li", { class: "order-row" }, [el("span", { class: "site-name", text: title }), el("span", { class: "order-actions" }, [up, down])]));
    });
    if (focusId) {
      let b = box.querySelector<HTMLButtonElement>('button[data-id="' + focusId + '"][data-dir="' + dir + '"]');
      if (b && b.disabled) b = box.querySelector<HTMLButtonElement>('button[data-id="' + focusId + '"]:not([disabled])');
      if (b) b.focus({ preventScroll: true });
    }
  }

  // Swaps a source with its neighbour of the same kind in state.shown.
  function move(id: string, dir: number): void {
    let list = shownLenses().filter(Boolean);
    let me = byId(id);
    let same = list.filter(function (l) { return l.mode === me.mode; });
    let at = same.indexOf(me), other = same[at + dir];
    if (!other) return;
    let i = state.shown.indexOf(id), j = state.shown.indexOf(other.id);
    state.shown[i] = other.id; state.shown[j] = id;
    persist();
    renderOrder(id, dir);
  }

  function renderManage() {
    renderEngine();
    renderOrder();
    let box = $("manage-list");
    box.textContent = "";
    let all = lenses();
    REGION_ORDER.forEach(function (region) {
      let list = all.filter(function (l) { return l.region === region; });
      if (!list.length) return;
      let ul = el("ul", { class: "manage-rows" });
      list.forEach(function (l) {
        let shown = state.shown.indexOf(l.id) >= 0;
        let input = el("input", { type: "checkbox", "aria-label": t("showLens", name(l)) });
        input.checked = shown;
        input.addEventListener("change", function () { setShown(l.id, input.checked); });
        let title = manageTitle(l);
        let info = el("div", { class: "manage-info" }, [
          el("span", { class: "site-name", text: title }),
          el("span", { class: "manage-sites", text: sitesSummary(l) }),
        ]);
        let row = el("li", { class: "manage-row" }, [el("label", { class: "manage-main" }, [input, info])]);
        if (region === "custom") {
          row.appendChild(el("div", { class: "manage-actions" }, [
            el("button", { type: "button", class: "btn-text", text: t("copyLink"), onclick: function () { copyShare(l); } }),
            el("button", { type: "button", class: "btn-text", text: t("edit"), onclick: function () { startEdit(l); } }),
            el("button", { type: "button", class: "btn-text danger", text: t("delete"), onclick: function () { deleteLens(l); } }),
          ]));
        }
        ul.appendChild(row);
      });
      let shownCount = list.filter(function (l) { return state.shown.indexOf(l.id) >= 0; }).length;
      let det = el("details", { class: "fold region" }, [
        el("summary", null, [el("h3", { text: t(`region_${region}`) }), el("span", { class: "muted", text: t("shownCount", shownCount, list.length) })]),
        ul,
      ]);
      if (!(region in openRegions)) openRegions[region] = region === "custom" || region === HOME_REGION;
      det.open = openRegions[region];
      det.addEventListener("toggle", function () { openRegions[region] = det.open; });
      box.appendChild(det);
    });
  }

  // Site names when they tell the sites apart, domains otherwise; long lists are cut short.
  function sitesSummary(l: { sites: Site[] }): string {
    let names = l.sites.map(function (s) { return s.name || s.domain; });
    let distinct = names.filter(function (n, i) { return names.indexOf(n) === i; }).length === names.length;
    let list = distinct ? names : l.sites.map(function (s) { return s.domain; });
    let MAX = 8;
    return list.length > MAX ? list.slice(0, MAX).join(", ") + " " + t("andMore", list.length - MAX) : list.join(", ");
  }

  function setShown(id: string, on: boolean): void {
    let i = state.shown.indexOf(id);
    if (on && i < 0) state.shown.push(id);
    if (!on && i >= 0) {
      state.shown.splice(i, 1);
      state.active = state.active.filter(function (x) { return x !== id; });
    }
    persist();
    renderManage();
  }

  function shareUrl(l: LensLike): string {
    let base = window.SOURCEPICK_WEB_URL || (location.origin + location.pathname.replace(/index\.html$/, ""));
    return base + "#add=" + core.encodeLens(l);
  }

  function copyText(text: string, done: () => void): void {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }

  function fallbackCopy(text: string): void {
    let ta = el("textarea", { readonly: true });
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* the link stays selectable on screen */ }
    ta.remove();
  }

  function copyShare(l: Lens): void {
    copyText(shareUrl(l), function () { flash("manage-done", t("linkCopied")); });
  }

  // core.normalizeDomain keeps the first word and accepts a bare word as a top-level domain
  // ("gov" for site:gov). Typed by hand, "hello world" or "naver" is a mistake, so only real-looking
  // endings are accepted without a dot.
  let BARE = ["com", "net", "org", "edu", "gov", "mil", "int", "info", "biz", "io", "ai", "dev", "app"];
  function siteInput(raw: string): string | null {
    raw = raw.trim();
    if (!raw || /\s/.test(raw)) return null;
    let d = core.normalizeDomain(raw);
    if (!d) return null;
    let host = d.split("/")[0];
    if (host.indexOf(".") < 0 && !/^[a-z]{2}$/.test(host) && BARE.indexOf(host) < 0) return null;
    return d;
  }

  function parseSites(text: string): { good: string[]; bad: string[] } {
    let good: string[] = [], bad: string[] = [];
    String(text || "").split(/[\s,]+/).filter(Boolean).forEach(function (raw) {
      let d = siteInput(raw);
      if (d) { if (good.indexOf(d) < 0) good.push(d); } else bad.push(raw);
    });
    return { good: good, bad: bad };
  }

  function sameLens(a: { mode?: LensMode; sites: Site[] }, b: { mode?: LensMode; sites: Site[] }): boolean {
    let x = core.lensDomains(a).slice().sort().join(" "), y = core.lensDomains(b).slice().sort().join(" ");
    return a.mode === b.mode && x === y;
  }

  // Adds a lens to "My sources", or returns the id of an identical one already there.
  function addCustom(lens: SharedLens): string {
    let dup = state.custom.filter(function (l) { return sameLens(l, lens); })[0];
    if (dup) {
      if (state.shown.indexOf(dup.id) < 0) state.shown.unshift(dup.id);
      return dup.id;
    }
    let id = "my-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    state.custom.push({ id: id, name: lens.name, mode: lens.mode, sites: lens.sites.map(function (s) { return { domain: s.domain }; }) });
    state.shown.unshift(id);
    return id;
  }

  function startEdit(l: Lens): void {
    $("edit-id").value = l.id;
    $("new-name").value = name(l);
    (document.querySelector<HTMLInputElement>('input[name="new-mode"][value="' + l.mode + '"]') as HTMLInputElement).checked = true;
    $("new-sites").value = l.sites.map(function (s) { return s.domain; }).join("\n");
    $("new-submit").textContent = t("saveChanges");
    $("new-cancel").hidden = false;
    $("h-new").textContent = t("editLens");
    $("h-new").scrollIntoView({ behavior: "smooth", block: "start" });
    $("new-name").focus({ preventScroll: true });
  }

  function resetForm() {
    $("new-lens-form").reset();
    $("edit-id").value = "";
    $("new-submit").textContent = t("saveLens");
    $("new-cancel").hidden = true;
    $("h-new").textContent = t("newLens");
    showMsg("new-error", "");
  }

  function deleteLens(l: Lens): void {
    if (!window.confirm(t("confirmDelete", name(l)))) return;
    state.custom = state.custom.filter(function (x) { return x.id !== l.id; });
    state.shown = state.shown.filter(function (x) { return x !== l.id; });
    state.active = state.active.filter(function (x) { return x !== l.id; });
    persist();
    renderManage();
    flash("manage-done", t("deleted"));
  }

  // ---------- routing ----------
  let manageFromMain = false;

  function route() {
    let hash = location.hash;
    let wasMain = !$("view-main").hidden && routed;
    routed = true;
    if (hash.indexOf("#add=") === 0) {
      pendingImport = core.decodeLens(hash.slice(5));
      badImport = !pendingImport;
      history.replaceState(null, "", location.pathname + location.search);
      hash = "";
    }
    let manage = hash === "#manage" || hash === "#new";
    if (manage) manageFromMain = manageFromMain || wasMain; else manageFromMain = false;
    $("view-main").hidden = manage;
    $("view-manage").hidden = !manage;
    if (manage) {
      renderManage();
      window.scrollTo(0, 0);
      if (hash === "#new") { history.replaceState(null, "", location.pathname + location.search + "#manage"); $("new-name").focus(); }
    } else { renderMain(); renderImportCard(); }
  }

  function renderImportCard() {
    let card = $("import-card");
    $("import-add").hidden = !pendingImport;
    if (badImport) {
      $("import-text").textContent = t("badLink");
      $("import-sites").textContent = "";
      card.hidden = false;
      return;
    }
    if (!pendingImport) { card.hidden = true; return; }
    $("import-text").textContent = t("importAsk", pendingImport.name, pendingImport.sites.length);
    $("import-sites").textContent = sitesSummary(pendingImport);
    card.hidden = false;
  }

  // ---------- events ----------
  function bind() {
    $("search-form").addEventListener("submit", function (e) {
      let q = $("q").value.trim();
      if (!q) { e.preventDefault(); $("q").focus(); return; }
      rememberQuery(q);
      // On phones the web app searches in the same tab through ?q= (redirect.js reads the saved
      // selection). Being a real form submission also lets Chrome offer Sourcepick as a search
      // engine. Falls back to the old way when the selection could not be saved.
      if (!isExt && isPhone && savedMatches()) { $("q").value = q; return; }
      e.preventDefault();
      if (applyTab()) return;
      let c = current();
      openUrl(core.searchUrl(q, c.include, c.exclude, opts()));
    });
    $("q").addEventListener("input", function () { renderPerSite(); renderLimit(); });
    $("multi").addEventListener("change", function () { state.multi = this.checked; persist(); });

    $("clear").addEventListener("click", function () {
      state.active = state.active.filter(function (id) { let l = byId(id); return l && l.mode === "exclude"; });
      state.extra = [];
      persist();
      renderMain();
      applyTab();
    });

    $("open-manage").addEventListener("click", function (e) {
      if (isPopup && chrome.runtime && chrome.runtime.openOptionsPage) {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
        window.close();
      }
    });

    $("edit-toggle").addEventListener("click", function () {
      let ed = $("editor");
      ed.hidden = !ed.hidden;
      this.setAttribute("aria-expanded", ed.hidden ? "false" : "true");
      this.textContent = ed.hidden ? t("editSites") : t("editDone");
    });

    $("add-site-form").addEventListener("submit", function (e) {
      e.preventDefault();
      let d = siteInput($("add-site").value);
      if (!d) { showMsg("add-site-error", t("badDomain")); $("add-site").focus(); return; }
      showMsg("add-site-error", "");
      let i = state.off.indexOf(d);
      if (i >= 0) state.off.splice(i, 1);
      if (current().include.indexOf(d) < 0) state.extra.push(d);
      $("add-site").value = "";
      persist();
      renderMain();
    });

    $("save-lens-form").addEventListener("submit", function (e) {
      e.preventDefault();
      let nm = $("save-lens-name").value.trim();
      let c = current();
      if (!nm) { showMsg("save-lens-error", t("needName")); return; }
      if (!c.include.length) { showMsg("save-lens-error", t("needSites")); return; }
      showMsg("save-lens-error", "");
      let id = addCustom({ name: nm, mode: "include", sites: c.include.map(function (d) { return { domain: d }; }) });
      state.active = state.active.filter(function (x) { let l = byId(x); return l && l.mode === "exclude"; });
      state.active.push(id);
      state.extra = [];
      $("save-lens-name").value = "";
      persist();
      renderMain();
    });

    $("share-selection").addEventListener("click", shareSelection);

    $("forums").addEventListener("change", function () {
      state.forums = this.checked; persist(); renderOptions(); renderPerSite(); applyTab();
    });

    $("engine-url").textContent = engineUrl();
    $("copy-engine").addEventListener("click", function () {
      copyText(engineUrl(), function () { flash("copy-done", t("copied")); });
    });

    $("import-add").addEventListener("click", function () {
      if (!pendingImport) return;
      let id = addCustom(pendingImport);
      if (pendingImport.mode === "include") {
        state.active = state.active.filter(function (x) { let l = byId(x); return l && l.mode === "exclude"; });
      }
      if (state.active.indexOf(id) < 0) state.active.push(id);
      pendingImport = null;
      persist();
      renderMain();
      renderImportCard();
      let btn = document.querySelector<HTMLElement>("#lens-grid .is-on");
      if (btn) btn.focus();
    });
    $("import-close").addEventListener("click", function () { pendingImport = null; badImport = false; renderImportCard(); });

    $("new-lens-form").addEventListener("submit", function (e) {
      e.preventDefault();
      let nm = $("new-name").value.trim();
      let mode = (document.querySelector<HTMLInputElement>('input[name="new-mode"]:checked') as HTMLInputElement).value as LensMode;
      let parsed = parseSites($("new-sites").value);
      if (!nm) { showMsg("new-error", t("needName")); return; }
      if (parsed.bad.length) { showMsg("new-error", t("badDomains", parsed.bad.slice(0, 3).join(", "))); return; }
      if (!parsed.good.length) { showMsg("new-error", t("needSitesManage")); return; }
      let sites = parsed.good.map(function (d) { return { domain: d }; });
      let editId = $("edit-id").value;
      if (editId) {
        state.custom.forEach(function (l) { if (l.id === editId) { l.name = nm; l.mode = mode; l.sites = sites; } });
      } else {
        addCustom({ name: nm, mode: mode, sites: sites });
      }
      persist();
      resetForm();
      renderManage();
      flash("manage-done", editId ? t("changesSaved") : t("lensSaved"));
    });
    $("new-cancel").addEventListener("click", resetForm);

    $("import-form").addEventListener("submit", function (e) {
      e.preventDefault();
      let v = $("import-link").value.trim();
      let m = v.match(/#add=([A-Za-z0-9_-]+)/);
      let lens = core.decodeLens(m ? m[1] : v);
      if (!lens) { showMsg("import-error", t("badLink")); return; }
      showMsg("import-error", "");
      let before = state.custom.length;
      addCustom(lens);
      $("import-link").value = "";
      persist();
      renderManage();
      flash("manage-done", t(state.custom.length > before ? "lensAdded" : "alreadyAdded", lens.name));
    });

    $("reset").addEventListener("click", function () {
      if (!window.confirm(t("confirmReset"))) return;
      state = store.defaults();
      persist();
      resetForm();
      renderManage();
      flash("manage-done", t("resetDone"));
    });

    // Back returns to the entry the person came from, so the browser's back button does not
    // bounce them into Manage again; opened straight on #manage it simply shows the main view.
    document.querySelector<HTMLAnchorElement>("#view-manage .back")!.addEventListener("click", function (e) {
      e.preventDefault();
      if (manageFromMain) { history.back(); return; }
      history.replaceState(null, "", location.pathname + location.search);
      route();
    });

    window.addEventListener("hashchange", route);
    store.onChange(function (s) {
      state = s;
      if ($("view-manage").hidden) renderMain(); else renderManage();
    });
  }

  // ---------- start ----------
  i18n.apply(document);
  // iPad and some iPhone setups report a Mac user agent; a touch screen on "Macintosh" means iOS.
  let isPhone = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (isExt) {
    $("bar-web").hidden = true;
    $("bar-ext").hidden = false;
    $("way-phone").hidden = true;
    $("way-ext").hidden = true;
  }
  // Phone browsers do not let people add their own search engines. Chrome for Android lists the web
  // app after one search from its form (see docs/ARCHITECTURE.md); Samsung Internet and Safari do not.
  let ua = navigator.userAgent;
  let isAndroidChrome = /Android/.test(ua) && /Chrome\//.test(ua) && !/SamsungBrowser|EdgA|OPR|Whale|Firefox|YaBrowser|; wv\)/.test(ua);
  if (!isExt && isPhone) {
    if (isAndroidChrome) { $("bar-web").hidden = true; $("bar-android").hidden = false; }
    else $("way-bar").hidden = true;
  }
  renderExtLinks();

  // Store buttons once the extension is published; until then a link to the install guide, or nothing.
  function renderExtLinks() {
    let links: SourcepickLinks = window.SOURCEPICK_LINKS || {};
    let box = $("ext-links");
    ([["chrome", "storeChrome"], ["edge", "storeEdge"], ["firefox", "storeFirefox"]] as const).forEach(function (x) {
      if (links[x[0]]) box.appendChild(el("a", { class: "btn-secondary", href: links[x[0]], target: "_blank", rel: "noopener", text: t(x[1]) }));
    });
    if (!box.children.length && links.repo) box.appendChild(el("a", { class: "btn-secondary", href: links.repo + "#install", target: "_blank", rel: "noopener", text: t("installGuide") }));
    if (!box.children.length) $("way-ext").hidden = true;
  }

  // The last search stays in the box when the person comes back from the results (same tab on
  // phones, where the page may be reloaded instead of restored), so it is easy to change and search again.
  let QKEY = "sourcepick:q";
  function rememberQuery(q: string): void {
    if (isExt) return;
    try { sessionStorage.setItem(QKEY, q); } catch (e) { /* storage blocked */ }
  }
  function restoreQuery(): void {
    if (isExt || $("q").value) return;
    try { $("q").value = sessionStorage.getItem(QKEY) || ""; } catch (e) { /* storage blocked */ }
  }

  store.load().then(function (s) {
    state = s;
    // Drop ids of lenses that no longer exist (renamed or removed in an update).
    let ids = lenses().map(function (l) { return l.id; });
    state.shown = state.shown.filter(function (id) { return ids.indexOf(id) >= 0; });
    state.active = state.active.filter(function (id) { return ids.indexOf(id) >= 0; });
    bind();
    restoreQuery();
    connectTab(route);
    if (!isPopup && !pendingImport && $("view-manage").hidden && matchMedia("(min-width: 700px)").matches) $("q").focus();
    if (isPopup) $("q").focus();
  });

  if (!isExt && "serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();

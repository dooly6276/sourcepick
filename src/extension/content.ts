// Adds a row of source buttons to Google, Bing, DuckDuckGo and Brave Search result pages.
// A button rewrites the site: filters at the end of the query and searches again, so the page URL
// always reflects what is applied. The buttons shown follow the extension's settings. The page's
// own search box and title show the words without the filters (see "A clean search box").
(function () {
  "use strict";
  let core = globalThis.SourceCore;
  let store = globalThis.SourceStore;
  let i18n = globalThis.SourceI18n;
  if (!core || !store || !i18n || window.__sourcepickBar) return;
  window.__sourcepickBar = true;

  let host = location.hostname;
  // Where the bar goes: inside parent, before a child of it, lined up with the results column.
  interface Place { parent: HTMLElement; before: Node | null; alignTo: Element | null }

  let found: EngineId | null = /(^|\.)google\./.test(host) ? "google" : /(^|\.)bing\.com$/.test(host) ? "bing" : /duckduckgo\.com$/.test(host) ? "duckduckgo" : /search\.brave\.com$/.test(host) ? "brave" : null;
  if (!found) return;
  const ENGINE: EngineId = found;

  // Where the bar goes on each engine. Each returns { parent, before, alignTo } or null.
  let PLACE: Record<EngineId, () => Place | null> = {
    google: function () {
      let appbar = document.getElementById("appbar");
      if (appbar && appbar.parentElement) return { parent: appbar.parentElement, before: appbar, alignTo: document.getElementById("center_col") || document.getElementById("rso") };
      // Images and other full-width tabs have no #appbar: go right above the results, below the tabs.
      let center = document.getElementById("center_col");
      if (center && document.getElementById("rso")) return { parent: center, before: center.firstChild, alignTo: document.getElementById("rso") };
      let cnt = document.getElementById("cnt");
      if (cnt) return { parent: cnt, before: cnt.firstChild, alignTo: document.getElementById("center_col") };
      let rso = document.getElementById("rso");
      if (rso && rso.parentElement) return { parent: rso.parentElement, before: rso, alignTo: null };
      // Mobile layout (Firefox for Android and others): #main starts with the tab row, then results.
      let main = document.getElementById("main");
      if (main && main.firstElementChild) return { parent: main, before: main.firstElementChild.nextSibling, alignTo: null };
      return null;
    },
    bing: function () {
      // Above the results-count row, so answer blocks at the top of the results do not push it down.
      let results = document.getElementById("b_results");
      let tween = document.getElementById("b_tween");
      if (tween && tween.parentElement) return { parent: tween.parentElement, before: tween, alignTo: results || tween };
      return results && results.parentElement ? { parent: results.parentElement, before: results, alignTo: results } : null;
    },
    duckduckgo: function () {
      let main = document.querySelector<HTMLElement>('section[data-testid="mainline"]');
      return main ? { parent: main, before: main.firstChild, alignTo: null } : null;
    },
    brave: function () {
      let nav = document.querySelector("header nav, nav#tab-container, main nav");
      if (nav && nav.parentElement) return { parent: nav.parentElement, before: nav.nextSibling, alignTo: document.querySelector("main .snippet") || nav };
      let snippet = document.querySelector("#results, .snippet");
      return snippet && snippet.parentElement ? { parent: snippet.parentElement, before: snippet, alignTo: null } : null;
    },
  };

  let state: State | null = null;
  let bar: HTMLElement | null = null;
  let expanded = false;
  let lastUrl = "";

  function query(): string { return new URL(location.href).searchParams.get("q") || ""; }

  function go(include: string[], exclude: string[]): void {
    let url = new URL(location.href);
    forget();
    location.assign(core.searchUrl(boxText() || query(), include, exclude, { engine: ENGINE, keepFrom: url.searchParams }));
  }

  // ---- A clean search box ----
  // With sources applied, the query is "words site:a.com OR site:b.com ...". The bar already shows
  // which sources are on, so the page's search box and tab title show the words alone, and a search
  // from that box gets the same sources again. Only filters that come from the pressed buttons are
  // hidden: a site: the person typed, or one no button explains, stays visible in the box.
  const STICKY = "sourcepick:sticky";
  let applied: Filters | null = null; // the filters searches from the box carry, when the box is clean
  let cleanText = "";
  let pressedDomains: string[] = [];

  type Box = HTMLInputElement | HTMLTextAreaElement;
  function boxes(): Box[] {
    return Array.from(document.querySelectorAll<Box>('textarea[name="q"], input[name="q"]:not([type="hidden"])'));
  }
  function isBox(el: EventTarget | null): el is Box {
    return !!el && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) && el.name === "q" && el.type !== "hidden";
  }
  // The words in the search box when they were edited after a clean-up, so a button click keeps them.
  function boxText(): string {
    if (!applied) return "";
    let el = document.activeElement;
    let box = isBox(el) ? el : boxes().filter(function (b) { return b.offsetParent !== null; })[0];
    let text = box ? box.value.trim() : "";
    return text && text !== cleanText ? text : "";
  }
  // DuckDuckGo keeps the box text in page state and puts the old text back on focus. The native
  // setter and an input event update that state the same way typing does.
  function setBox(el: Box, text: string): void {
    let d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
    if (d && d.set) d.set.call(el, text); else el.value = text;
    if (ENGINE === "duckduckgo" && document.activeElement !== el) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      // The input event opens its suggestion list; the box is not in use, so close it again.
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
    }
  }
  function unhide(): void { let s = document.getElementById("sourcepick-hide"); if (s) s.remove(); }

  function tidy(): void {
    let q = query();
    let f = core.parseFilters(q);
    let all = f.include.concat(f.exclude);
    let was = applied ? cleanText : "";
    applied = null;
    // Only while the bar is on screen: some views (DuckDuckGo images and news) hide it.
    if (all.length && bar && bar.offsetHeight > 0 && all.every(function (d) { return pressedDomains.indexOf(d) >= 0; })) {
      applied = f;
      cleanText = core.stripFilters(q);
      if (!cleanText) applied = null;
    }
    if (!applied && was) {
      // The bar went out of view: show the full query again so the filters are not hidden.
      boxes().forEach(function (el) { if (el.value === was && q !== was) setBox(el, q); });
    }
    if (applied) {
      boxes().forEach(function (el) {
        // Only the engine's own copy of the full query is replaced, never words being typed.
        if (el.value === cleanText || core.stripFilters(el.value) !== cleanText) return;
        setBox(el, cleanText);
        if (document.activeElement === el) el.setSelectionRange(cleanText.length, cleanText.length);
      });
      if (/(^|\s)-?site:\S/i.test(document.title)) document.title = core.stripFilters(document.title);
    }
    unhide();
  }

  function remember(): void {
    if (!applied) return;
    try { sessionStorage.setItem(STICKY, JSON.stringify({ e: ENGINE, i: applied.include, x: applied.exclude, t: Date.now(), from: location.href })); } catch (e) { /* storage blocked */ }
  }
  function forget(): void { try { sessionStorage.removeItem(STICKY); } catch (e) { /* storage blocked */ } }

  // Searches the words with the sources that are on. Returns false to leave the search to the page:
  // nothing to add, or the words carry their own site: filters.
  function searchFromBox(text: string): boolean {
    text = text.trim();
    if (!applied || !text) return false;
    let own = core.parseFilters(text);
    if (own.include.length || own.exclude.length) return false;
    forget();
    location.assign(core.searchUrl(text, applied.include, applied.exclude, { engine: ENGINE, keepFrom: new URL(location.href).searchParams }));
    return true;
  }

  // A search that left the box without the sources (a suggestion the engine opens by itself, a
  // search button that skips the form) is sent again once with them. The note is read and removed
  // on the next results page, so this can happen only once per search.
  function rescue(): boolean {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(STICKY); } catch (e) { return false; }
    if (!raw) return false;
    let m: { e?: string; i?: string[]; x?: string[]; t?: number; from?: string };
    try { m = JSON.parse(raw); } catch (e) { forget(); return false; }
    if (m.from === location.href) return false;
    forget();
    let q = query();
    let f = core.parseFilters(q);
    if (m.e !== ENGINE || !m.t || Date.now() - m.t > 10000 || !q || f.include.length || f.exclude.length) return false;
    let inc = (m.i || []).filter(function (d) { return typeof d === "string"; });
    let exc = (m.x || []).filter(function (d) { return typeof d === "string"; });
    if (!inc.length && !exc.length) return false;
    location.replace(core.searchUrl(q, inc, exc, { engine: ENGINE, keepFrom: new URL(location.href).searchParams }));
    return true;
  }

  document.addEventListener("keydown", function (e) {
    if (!applied || e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || !isBox(e.target)) return;
    remember();
    // While an input method is composing, Enter only ends the word; the page gets another Enter.
    if (e.isComposing) return;
    if (searchFromBox(e.target.value)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener("submit", function (e) {
    let form = e.target as HTMLFormElement;
    if (!applied || !(form instanceof HTMLFormElement)) return;
    let box = boxes().filter(function (b) { return b.form === form; })[0];
    if (box && searchFromBox(box.value)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  // Suggestions and search buttons that navigate on their own: note the sources for the next page.
  document.addEventListener("pointerdown", function (e) {
    let t = e.target as Element | null;
    if (!applied || !t || !t.closest) return;
    if (t.closest('[role="option"], [role="listbox"], button[type="submit"], input[type="submit"]')) { remember(); return; }
    let labelled = t.closest("[aria-label]");
    if (labelled && !isBox(labelled) && labelled.closest("form") && /search|검색|検索/i.test(labelled.getAttribute("aria-label") || "")) remember();
  }, true);
  window.addEventListener("pageshow", function () { if (bar) tidy(); });

  // A click searches that source alone; clicking it again searches the whole web. With "choose
  // several" on, or Ctrl, Cmd or Shift held, clicks add and remove sources instead.
  function toggle(lens: Lens, on: boolean, add: boolean): void {
    let f = core.parseFilters(query());
    let ds = core.lensDomains(lens);
    let key: LensMode = lens.mode === "exclude" ? "exclude" : "include";
    if (key === "include" && !add && !(state && state.multi)) {
      go(on ? [] : ds, f.exclude);
      return;
    }
    if (on) f[key] = f[key].filter(function (d) { return ds.indexOf(d) < 0; });
    else ds.forEach(function (d) { if (f[key].indexOf(d) < 0) f[key].push(d); });
    go(f.include, f.exclude);
  }

  function button(text: string, pressed: boolean | null, onClick: (e: MouseEvent) => void, cls?: string): HTMLButtonElement {
    let b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    if (pressed !== null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
    if (cls) b.className = cls;
    b.addEventListener("click", onClick);
    return b;
  }

  function isDark(): boolean {
    let el: HTMLElement | null = document.body;
    while (el) {
      let m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (m && (m.length < 4 || +m[3] > 0)) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) < 128;
      el = el.parentElement;
    }
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function build(state: State): HTMLElement {
    let q = query();
    let all = store.allLenses(state);
    let shown = state.shown.map(function (id) { return all.filter(function (l) { return l.id === id; })[0]; }).filter(Boolean);
    let f = core.parseFilters(q);

    let b = document.createElement("div");
    b.id = "sourcepick-bar";
    b.setAttribute("data-owner", OWNER);
    b.setAttribute("role", "toolbar");
    b.setAttribute("aria-label", i18n.t("barLabel"));
    if (isDark()) b.classList.add("sp-dark");

    let label = document.createElement("span");
    label.className = "sp-label";
    label.textContent = i18n.t("barLabel");
    b.appendChild(label);

    let scroll = document.createElement("div");
    scroll.className = "sp-scroll";
    b.appendChild(scroll);
    let partial = null as { lens: Lens; applied: number } | null;
    pressedDomains = [];
    // Excluding sites only matters when searching the whole web: with sources chosen, results
    // already come from those sites alone, so the exclude buttons are left out then.
    ["include", "exclude"].forEach(function (mode, i) {
      let list = shown.filter(function (l) { return l.mode === mode; });
      if (!list.length || (mode === "exclude" && f.include.length)) return;
      if (i === 1 && scroll.children.length) { let sep = document.createElement("span"); sep.className = "sp-sep"; scroll.appendChild(sep); }
      list.forEach(function (l) {
        let st = core.lensState(q, l, ENGINE);
        let on = st !== "none";
        if (on) pressedDomains = pressedDomains.concat(core.lensDomains(l));
        if (st === "part") partial = { lens: l, applied: core.lensDomains(l).filter(function (d) { return f.include.indexOf(d) >= 0 || f.exclude.indexOf(d) >= 0; }).length };
        let btn = button(core.lensName(l, i18n.lensLang), on, function (e) { toggle(l, on, e.ctrlKey || e.metaKey || e.shiftKey); });
        btn.title = i18n.t("tileTitle", l.sites.length);
        scroll.appendChild(btn);
      });
    });

    let tail = document.createElement("span");
    tail.className = "sp-tail";
    if (partial) {
      let note = document.createElement("span");
      note.className = "sp-note";
      note.textContent = i18n.t("barPartial", partial.lens.sites.length, partial.applied);
      note.title = i18n.t(core.nearLength(q, ENGINE) ? "barPartialTitleLength" : "barPartialTitle", core.ENGINES[ENGINE].name, core.ENGINES[ENGINE].maxTerms);
      tail.appendChild(note);
    }
    if (f.include.length || f.exclude.length) tail.appendChild(button(i18n.t("barClear"), null, function () { go([], []); }, "sp-link"));
    tail.appendChild(button(i18n.t("barManage"), null, function () {
      try { chrome.runtime.sendMessage({ type: "openOptions" }); } catch (e) { /* extension was reloaded; the page needs a refresh */ }
    }, "sp-link"));
    b.appendChild(tail);
    return b;
  }

  function align(place: Place): void {
    if (!bar || !place.alignTo) return;
    let box = place.alignTo.getBoundingClientRect();
    let from = (bar.parentElement as HTMLElement).getBoundingClientRect().left;
    // Line up with the results, and keep at least 12px from the window edge.
    let left = Math.max(0, Math.round(box.left - from), Math.round(12 - from));
    bar.style.paddingLeft = left + "px";
    // Wrap within the results column instead of running past it.
    if (box.width > 300) bar.style.maxWidth = (left + Math.round(box.width) + 16) + "px";
  }

  let OWNER = "";
  try { OWNER = chrome.runtime.id || ""; } catch (e) { /* not running as an extension */ }

  function render(): void {
    if (!state) return;
    lastUrl = location.href;
    // Another copy of Sourcepick (the same folder loaded twice, or the store version next to a
    // developer copy) already shows its bar: leave the page to it instead of adding a second one.
    let other = document.getElementById("sourcepick-bar");
    if (other && other !== bar && other.getAttribute("data-owner") !== OWNER) { if (bar) bar.remove(); bar = null; unhide(); return; }
    if (rescue()) return;
    if (!query()) { if (bar) bar.remove(); bar = null; unhide(); return; }
    let place = PLACE[ENGINE]();
    if (!place) { unhide(); return; }
    let next = build(state);
    if (bar) bar.remove();
    bar = next;
    place.parent.insertBefore(bar, place.before && place.before.parentElement === place.parent ? place.before : null);
    align(place);
    // Bing pulls its results-count row up with a negative margin, which would overlap the bar.
    let after = place.before;
    if (after instanceof HTMLElement && bar.nextSibling === after) {
      let m = parseFloat(getComputedStyle(after).marginTop) || 0;
      if (m < 0) bar.style.marginBottom = (6 - m) + "px";
    }
    window.onresize = function () { align(place); };
    // Keep the chosen source in view when the row scrolls sideways.
    fold();
    let on = bar.querySelector<HTMLElement>('.sp-scroll button[aria-pressed="true"]');
    let row = bar.querySelector(".sp-scroll");
    if (on && row && on.offsetLeft + on.offsetWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - 8;
    tidy();
  }

  // With a mouse the row shows one line of sources and a button for the rest, so the bar does not
  // push the results down. A chosen source on a later line keeps the row open. Touch screens scroll.
  function fold(): void {
    if (!bar || matchMedia("(pointer: coarse)").matches) return;
    let row = bar.querySelector(".sp-scroll");
    if (!row) return;
    let btns = Array.from(row.querySelectorAll<HTMLElement>("button"));
    if (!btns.length) return;
    let top0 = btns[0].offsetTop;
    let later = btns.filter(function (b) { return b.offsetTop > top0 + 4; });
    if (!later.length) return;
    let open = expanded || later.some(function (b) { return b.getAttribute("aria-pressed") === "true"; });
    if (!open) row.classList.add("sp-fold");
    let tail = bar.querySelector(".sp-tail");
    if (!tail) return;
    tail.insertBefore(button(open ? i18n.t("barLess") : i18n.t("barMore", later.length), null, function () {
      expanded = !open;
      render();
    }, "sp-link"), tail.firstChild);
  }

  // Result pages that load results after the first paint (DuckDuckGo) or change the URL without a
  // reload need a few retries; stop once the bar is in place for the current URL.
  let tries = 0;
  function stale(): boolean {
    if (location.href !== lastUrl || !bar || !document.contains(bar)) return true;
    // DuckDuckGo redraws its results list and can leave the bar below it.
    return ENGINE === "duckduckgo" && !!bar.parentElement && bar.parentElement.firstElementChild !== bar;
  }
  function tick(): void {
    if (stale()) render();
    else tidy();
    tries++;
  }

  function start(): void {
    store.load().then(function (s: State) {
      state = s;
      render();
      // Bing swaps in a new results page without loading one and clears the page's timers when it
      // does, so changes to the page also trigger a check.
      let queued = false;
      let watch = new MutationObserver(function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          queued = false;
          if (stale()) render();
        });
      });
      watch.observe(document.documentElement, { childList: true, subtree: true });
      let timer = setInterval(function () {
        tick();
        if (tries > 40 && ENGINE === "google") { clearInterval(timer); watch.disconnect(); }
      }, 500);
    });
    store.onChange(function (s: State) { state = s; render(); });
  }
  // A page the engine loads ahead of time (a likely suggestion) waits until it is shown, so the
  // note for the next search is not read by a page nobody opens.
  if ((document as Document & { prerendering?: boolean }).prerendering) document.addEventListener("prerenderingchange", start, { once: true });
  else start();

  // The toolbar popup asks which results page is open so it can show and change its sources.
  try {
    chrome.runtime.onMessage.addListener(function (msg: { type?: string } | undefined, _sender: unknown, reply: (response: unknown) => void) {
      if (!msg || msg.type !== "sourcepick:page") return;
      // The popup may search this tab again with other sources: that search must not get the old ones back.
      forget();
      reply({ engine: ENGINE, query: query(), search: location.search });
    });
  } catch (e) { /* no extension messaging on this page */ }
})();

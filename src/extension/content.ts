// Adds a row of source buttons to Google, Bing, DuckDuckGo and Brave Search result pages.
// A button rewrites the site: filters at the end of the query and searches again, so the page URL
// always reflects what is applied. The buttons shown follow the extension's settings.
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
    location.assign(core.searchUrl(query(), include, exclude, { engine: ENGINE, keepFrom: url.searchParams }));
  }

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
    // Excluding sites only matters when searching the whole web: with sources chosen, results
    // already come from those sites alone, so the exclude buttons are left out then.
    ["include", "exclude"].forEach(function (mode, i) {
      let list = shown.filter(function (l) { return l.mode === mode; });
      if (!list.length || (mode === "exclude" && f.include.length)) return;
      if (i === 1 && scroll.children.length) { let sep = document.createElement("span"); sep.className = "sp-sep"; scroll.appendChild(sep); }
      list.forEach(function (l) {
        let st = core.lensState(q, l, ENGINE);
        let on = st !== "none";
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
    let left = Math.max(12, Math.round(box.left - (bar.parentElement as HTMLElement).getBoundingClientRect().left));
    bar.style.paddingLeft = left + "px";
    // Wrap within the results column instead of running past it.
    if (box.width > 300) bar.style.maxWidth = (left + Math.round(box.width) + 16) + "px";
  }

  function render(): void {
    if (!state) return;
    lastUrl = location.href;
    if (!query()) { if (bar) bar.remove(); bar = null; return; }
    let place = PLACE[ENGINE]();
    if (!place) return;
    let next = build(state);
    if (bar) bar.remove();
    bar = next;
    place.parent.insertBefore(bar, place.before && place.before.parentElement === place.parent ? place.before : null);
    align(place);
    window.onresize = function () { align(place); };
    // Keep the chosen source in view when the row scrolls sideways.
    fold();
    let on = bar.querySelector<HTMLElement>('.sp-scroll button[aria-pressed="true"]');
    let row = bar.querySelector(".sp-scroll");
    if (on && row && on.offsetLeft + on.offsetWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - 8;
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
  function tick(): void {
    if (location.href !== lastUrl || !bar || !document.contains(bar)) render();
    tries++;
  }

  store.load().then(function (s: State) {
    state = s;
    render();
    let timer = setInterval(function () {
      tick();
      if (tries > 40 && ENGINE === "google") clearInterval(timer);
    }, 500);
  });
  store.onChange(function (s: State) { state = s; render(); });

  // The toolbar popup asks which results page is open so it can show and change its sources.
  try {
    chrome.runtime.onMessage.addListener(function (msg: { type?: string } | undefined, _sender: unknown, reply: (response: unknown) => void) {
      if (msg && msg.type === "sourcepick:page") reply({ engine: ENGINE, query: query(), search: location.search });
    });
  } catch (e) { /* no extension messaging on this page */ }
})();

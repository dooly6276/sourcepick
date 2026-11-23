// Adds a row of source buttons to Google, DuckDuckGo and Brave Search result pages.
// A button rewrites the site: filters at the end of the query and searches again, so the page URL
// always reflects what is applied. The buttons shown follow the extension's settings.
(function () {
  "use strict";
  var core = globalThis.SourceCore;
  var store = globalThis.SourceStore;
  var i18n = globalThis.SourceI18n;
  if (!core || !store || !i18n || window.__sourcepickBar) return;
  window.__sourcepickBar = true;

  var host = location.hostname;
  var ENGINE = /(^|\.)google\./.test(host) ? "google" : /duckduckgo\.com$/.test(host) ? "duckduckgo" : /search\.brave\.com$/.test(host) ? "brave" : null;
  if (!ENGINE) return;

  // Where the bar goes on each engine. Each returns { parent, before, alignTo } or null.
  var PLACE = {
    google: function () {
      var appbar = document.getElementById("appbar");
      if (appbar && appbar.parentElement) return { parent: appbar.parentElement, before: appbar, alignTo: document.getElementById("center_col") || document.getElementById("rso") };
      var cnt = document.getElementById("cnt");
      if (cnt) return { parent: cnt, before: cnt.firstChild, alignTo: document.getElementById("center_col") };
      var rso = document.getElementById("rso");
      if (rso && rso.parentElement) return { parent: rso.parentElement, before: rso, alignTo: null };
      // Mobile layout (Firefox for Android and others): #main starts with the tab row, then results.
      var main = document.getElementById("main");
      if (main && main.firstElementChild) return { parent: main, before: main.firstElementChild.nextSibling, alignTo: null };
      return null;
    },
    duckduckgo: function () {
      var main = document.querySelector('section[data-testid="mainline"]');
      return main ? { parent: main, before: main.firstChild, alignTo: null } : null;
    },
    brave: function () {
      var nav = document.querySelector("header nav, nav#tab-container, main nav");
      if (nav && nav.parentElement) return { parent: nav.parentElement, before: nav.nextSibling, alignTo: document.querySelector("main .snippet") || nav };
      var snippet = document.querySelector("#results, .snippet");
      return snippet && snippet.parentElement ? { parent: snippet.parentElement, before: snippet, alignTo: null } : null;
    },
  };

  var state = null;
  var bar = null;
  var expanded = false;
  var lastUrl = "";

  function query() { return new URL(location.href).searchParams.get("q") || ""; }

  function go(include, exclude) {
    var url = new URL(location.href);
    location.assign(core.searchUrl(query(), include, exclude, { engine: ENGINE, keepFrom: url.searchParams }));
  }

  // A click searches that source alone; clicking it again searches the whole web. With "choose
  // several" on, or Ctrl, Cmd or Shift held, clicks add and remove sources instead.
  function toggle(lens, on, add) {
    var f = core.parseFilters(query());
    var ds = core.lensDomains(lens);
    var key = lens.mode === "exclude" ? "exclude" : "include";
    if (key === "include" && !add && !state.multi) {
      go(on ? [] : ds, f.exclude);
      return;
    }
    if (on) f[key] = f[key].filter(function (d) { return ds.indexOf(d) < 0; });
    else ds.forEach(function (d) { if (f[key].indexOf(d) < 0) f[key].push(d); });
    go(f.include, f.exclude);
  }

  function button(text, pressed, onClick, cls) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    if (pressed !== null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
    if (cls) b.className = cls;
    b.addEventListener("click", onClick);
    return b;
  }

  function isDark() {
    var el = document.body;
    while (el) {
      var m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (m && (m.length < 4 || +m[3] > 0)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
      el = el.parentElement;
    }
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function build() {
    var q = query();
    var all = store.allLenses(state);
    var shown = state.shown.map(function (id) { return all.filter(function (l) { return l.id === id; })[0]; }).filter(Boolean);
    var f = core.parseFilters(q);

    var b = document.createElement("div");
    b.id = "sourcepick-bar";
    b.setAttribute("role", "toolbar");
    b.setAttribute("aria-label", i18n.t("barLabel"));
    if (isDark()) b.classList.add("sp-dark");

    var label = document.createElement("span");
    label.className = "sp-label";
    label.textContent = i18n.t("barLabel");
    b.appendChild(label);

    var scroll = document.createElement("div");
    scroll.className = "sp-scroll";
    b.appendChild(scroll);
    var partial = null;
    // Excluding sites only matters when searching the whole web: with sources chosen, results
    // already come from those sites alone, so the exclude buttons are left out then.
    ["include", "exclude"].forEach(function (mode, i) {
      var list = shown.filter(function (l) { return l.mode === mode; });
      if (!list.length || (mode === "exclude" && f.include.length)) return;
      if (i === 1 && scroll.children.length) { var sep = document.createElement("span"); sep.className = "sp-sep"; scroll.appendChild(sep); }
      list.forEach(function (l) {
        var st = core.lensState(q, l, ENGINE);
        var on = st !== "none";
        if (st === "part") partial = { lens: l, applied: core.lensDomains(l).filter(function (d) { return f.include.indexOf(d) >= 0 || f.exclude.indexOf(d) >= 0; }).length };
        var btn = button(core.lensName(l, i18n.lensLang), on, function (e) { toggle(l, on, e.ctrlKey || e.metaKey || e.shiftKey); });
        btn.title = i18n.t("tileTitle", l.sites.length);
        scroll.appendChild(btn);
      });
    });

    var tail = document.createElement("span");
    tail.className = "sp-tail";
    if (partial) {
      var note = document.createElement("span");
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

  function align(place) {
    if (!bar || !place.alignTo) return;
    var box = place.alignTo.getBoundingClientRect();
    var left = Math.max(12, Math.round(box.left - bar.parentElement.getBoundingClientRect().left));
    bar.style.paddingLeft = left + "px";
    // Wrap within the results column instead of running past it.
    if (box.width > 300) bar.style.maxWidth = (left + Math.round(box.width) + 16) + "px";
  }

  function render() {
    if (!state) return;
    lastUrl = location.href;
    if (!query()) { if (bar) bar.remove(); bar = null; return; }
    var place = PLACE[ENGINE]();
    if (!place) return;
    var next = build();
    if (bar) bar.remove();
    bar = next;
    place.parent.insertBefore(bar, place.before && place.before.parentElement === place.parent ? place.before : null);
    align(place);
    window.onresize = function () { align(place); };
    // Keep the chosen source in view when the row scrolls sideways.
    fold();
    var on = bar.querySelector('.sp-scroll button[aria-pressed="true"]');
    var row = bar.querySelector(".sp-scroll");
    if (on && row && on.offsetLeft + on.offsetWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - 8;
  }

  // With a mouse the row shows one line of sources and a button for the rest, so the bar does not
  // push the results down. A chosen source on a later line keeps the row open. Touch screens scroll.
  function fold() {
    if (matchMedia("(pointer: coarse)").matches) return;
    var row = bar.querySelector(".sp-scroll");
    var btns = Array.prototype.slice.call(row.querySelectorAll("button"));
    if (!btns.length) return;
    var top0 = btns[0].offsetTop;
    var later = btns.filter(function (b) { return b.offsetTop > top0 + 4; });
    if (!later.length) return;
    var open = expanded || later.some(function (b) { return b.getAttribute("aria-pressed") === "true"; });
    if (!open) row.classList.add("sp-fold");
    var tail = bar.querySelector(".sp-tail");
    tail.insertBefore(button(open ? i18n.t("barLess") : i18n.t("barMore", later.length), null, function () {
      expanded = !open;
      render();
    }, "sp-link"), tail.firstChild);
  }

  // Result pages that load results after the first paint (DuckDuckGo) or change the URL without a
  // reload need a few retries; stop once the bar is in place for the current URL.
  var tries = 0;
  function tick() {
    if (location.href !== lastUrl || !bar || !document.contains(bar)) render();
    tries++;
  }

  store.load().then(function (s) {
    state = s;
    render();
    var timer = setInterval(function () {
      tick();
      if (tries > 40 && ENGINE === "google") clearInterval(timer);
    }, 500);
  });
  store.onChange(function (s) { state = s; render(); });

  // The toolbar popup asks which results page is open so it can show and change its sources.
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
      if (msg && msg.type === "sourcepick:page") reply({ engine: ENGINE, query: query(), search: location.search });
    });
  } catch (e) { /* no extension messaging on this page */ }
})();

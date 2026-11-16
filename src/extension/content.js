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
  var lastUrl = "";

  function query() { return new URL(location.href).searchParams.get("q") || ""; }

  function go(include, exclude) {
    var url = new URL(location.href);
    location.assign(core.searchUrl(query(), include, exclude, { engine: ENGINE, keepFrom: url.searchParams }));
  }

  function toggle(lens, on) {
    var f = core.parseFilters(query());
    var ds = core.lensDomains(lens);
    var key = lens.mode === "exclude" ? "exclude" : "include";
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
    var active = core.activeLensIds(q, all);
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

    ["include", "exclude"].forEach(function (mode, i) {
      var list = shown.filter(function (l) { return l.mode === mode; });
      if (!list.length) return;
      if (i === 1) { var sep = document.createElement("span"); sep.className = "sp-sep"; b.appendChild(sep); }
      list.forEach(function (l) {
        var on = active.indexOf(l.id) >= 0;
        b.appendChild(button(core.lensName(l, i18n.lensLang), on, function () { toggle(l, on); }));
      });
    });

    var tail = document.createElement("span");
    tail.className = "sp-tail";
    if (f.include.length || f.exclude.length) tail.appendChild(button(i18n.t("barClear"), null, function () { go([], []); }, "sp-link"));
    tail.appendChild(button(i18n.t("barManage"), null, function () {
      try { chrome.runtime.sendMessage({ type: "openOptions" }); } catch (e) { /* extension was reloaded; the page needs a refresh */ }
    }, "sp-link"));
    b.appendChild(tail);
    return b;
  }

  function align(place) {
    if (!bar || !place.alignTo) return;
    var left = place.alignTo.getBoundingClientRect().left - bar.parentElement.getBoundingClientRect().left;
    bar.style.paddingLeft = Math.max(12, Math.round(left)) + "px";
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
})();

// Settings storage. Extension pages and content scripts use chrome.storage.local so the popup,
// the options page and the results-page bar share one state; the web app uses localStorage.
(function (root) {
  "use strict";

  var KEY = "sourcepick:v2";
  var ext = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  var DEFAULTS = {
    ko: {
      shown: ["kr-community", "kr-blog", "kr-qna", "kr-video", "kr-wiki", "kr-news", "kr-shop", "kr-reviews", "forums",
        "social", "kr-papers", "kr-gov", "kr-stats", "kr-law", "kr-edu", "kr-courses", "kr-jobs", "kr-used", "kr-books",
        "kr-no-blog", "kr-no-news", "kr-no-namu"],
      active: ["kr-community"],
    },
    ja: {
      shown: ["jp-forums", "jp-blogs", "jp-dev", "forums", "reddit", "video", "social", "papers", "wiki", "no-pinterest"],
      active: ["jp-forums"],
    },
    en: {
      shown: ["forums", "reddit", "dev", "docs", "papers", "video", "social", "reviews", "wiki", "blogs", "gov",
        "no-pinterest", "no-news"],
      active: ["forums"],
    },
  };

  // Defaults as they were before sources were added on 2026-11-24. A saved state without `known`
  // is compared with these, so new default sources appear once and removed ones stay removed.
  var OLD = {
    ko: ["kr-community", "kr-blog", "kr-qna", "video", "kr-wiki", "forums", "kr-papers", "kr-gov", "kr-law",
      "kr-no-blog", "kr-no-news", "kr-no-namu"],
    ja: DEFAULTS.ja.shown,
    en: DEFAULTS.en.shown,
  };
  var REPLACED = { "kr-video": "video" };

  function addNew(shown, known, d) {
    var out = shown.slice();
    d.shown.forEach(function (id) {
      if (known.indexOf(id) >= 0 || out.indexOf(id) >= 0) return;
      var old = REPLACED[id] ? out.indexOf(REPLACED[id]) : -1;
      if (old >= 0) { out[old] = id; return; }
      var at = out.findIndex(function (x) { return /(^|-)no-/.test(x); });
      if (at < 0 || /(^|-)no-/.test(id)) out.push(id); else out.splice(at, 0, id);
    });
    return out;
  }

  function lang() {
    var l = (typeof navigator !== "undefined" && navigator.language || "en").toLowerCase();
    if (l.indexOf("ko") === 0) return "ko";
    if (l.indexOf("ja") === 0) return "ja";
    return "en";
  }

  function defaults() {
    var d = DEFAULTS[lang()];
    return {
      v: 2,
      shown: d.shown.slice(),
      known: d.shown.slice(),
      active: d.active.slice(),
      off: [],
      extra: [],
      custom: [],
      engine: "google",
      period: "",
      forums: false,
      multi: false,
    };
  }

  function arr(x) { return Array.isArray(x) ? x : null; }

  function sanitize(s) {
    var d = defaults();
    if (!s || typeof s !== "object") return d;
    var known = arr(s.known) || OLD[lang()];
    return {
      v: 2,
      shown: arr(s.shown) ? addNew(s.shown, known, d) : d.shown,
      known: known.concat(d.shown.filter(function (id) { return known.indexOf(id) < 0; })),
      active: arr(s.active) || d.active,
      off: arr(s.off) || [],
      extra: arr(s.extra) || [],
      custom: (arr(s.custom) || []).filter(function (l) {
        return l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.sites);
      }),
      engine: ["google", "bing", "duckduckgo", "brave"].indexOf(s.engine) >= 0 ? s.engine : "google",
      period: ["", "d", "w", "m", "y"].indexOf(s.period) >= 0 ? s.period : "",
      forums: !!s.forums,
      multi: !!s.multi,
    };
  }

  // Synchronous read for the web app's redirect page, which must not wait.
  function readLocal() {
    try { return sanitize(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) { return defaults(); }
  }

  function load() {
    if (ext) {
      return new Promise(function (resolve) {
        chrome.storage.local.get(KEY, function (r) { resolve(sanitize(r && r[KEY])); });
      });
    }
    return Promise.resolve(readLocal());
  }

  function save(state) {
    if (ext) {
      var o = {};
      o[KEY] = state;
      return new Promise(function (resolve) { chrome.storage.local.set(o, resolve); });
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep working without saving */ }
    return Promise.resolve();
  }

  function onChange(fn) {
    if (ext && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && changes[KEY]) fn(sanitize(changes[KEY].newValue));
      });
    }
  }

  // Built-in lenses plus the user's own, with custom lenses first.
  function allLenses(state) {
    var builtin = root.SOURCE_LENSES || [];
    return state.custom.map(function (l) { return Object.assign({ region: "custom", mode: "include" }, l); }).concat(builtin);
  }

  root.SourceStore = {
    KEY: KEY,
    lang: lang,
    defaults: defaults,
    sanitize: sanitize,
    readLocal: readLocal,
    load: load,
    save: save,
    onChange: onChange,
    allLenses: allLenses,
    isExtension: !!ext,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

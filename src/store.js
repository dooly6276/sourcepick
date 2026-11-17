// Settings storage. Extension pages and content scripts use chrome.storage.local so the popup,
// the options page and the results-page bar share one state; the web app uses localStorage.
(function (root) {
  "use strict";

  var KEY = "sourcepick:v2";
  var ext = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  var DEFAULTS = {
    ko: {
      shown: ["kr-community", "kr-work", "kr-cafe", "kr-blog", "kr-qna", "video", "forums", "kr-it", "kr-games",
        "kr-dev", "kr-papers", "kr-gov", "kr-law", "kr-wiki", "kr-no-news", "no-pinterest"],
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
    return {
      v: 2,
      shown: arr(s.shown) || d.shown,
      active: arr(s.active) || d.active,
      off: arr(s.off) || [],
      extra: arr(s.extra) || [],
      custom: (arr(s.custom) || []).filter(function (l) {
        return l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.sites);
      }),
      engine: ["google", "duckduckgo", "brave"].indexOf(s.engine) >= 0 ? s.engine : "google",
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

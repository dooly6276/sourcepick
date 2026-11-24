// Settings storage. Extension pages and content scripts use chrome.storage.local so the popup,
// the options page and the results-page bar share one state; the web app uses localStorage.
(function (root: typeof globalThis) {
  "use strict";

  let KEY = "sourcepick:v2";
  let ext = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  let DEFAULTS: Record<Lang, { shown: string[]; active: string[] }> = {
    ko: {
      shown: ["kr-community", "kr-blog", "kr-qna", "kr-video", "kr-wiki", "kr-news", "kr-shop", "kr-reviews", "forums",
        "social", "kr-papers", "kr-gov", "kr-stats", "kr-law", "kr-edu", "kr-courses", "kr-jobs", "kr-used", "kr-books",
        "kr-no-blog", "kr-no-news", "kr-no-namu"],
      active: ["kr-community"],
    },
    ja: {
      shown: ["jp-forums", "jp-qna", "jp-blogs", "jp-video", "jp-wiki", "jp-news", "jp-shop", "jp-reviews", "forums",
        "social", "jp-papers", "jp-gov", "jp-law", "jp-jobs", "jp-used", "jp-books", "jp-recipes", "jp-dev",
        "jp-no-matome", "jp-no-chiebukuro", "jp-no-news", "no-pinterest"],
      active: ["jp-forums"],
    },
    en: {
      shown: ["forums", "reddit", "qna", "blogs", "video", "wiki", "news", "shop", "reviews", "social", "papers", "gov",
        "stats", "law", "edu", "courses", "jobs", "used", "books", "dev", "docs",
        "no-pinterest", "no-quora", "no-shopping", "no-news"],
      active: ["forums"],
    },
  };

  // Defaults as they were before sources were added on 2026-11-24. A saved state without `known`
  // is compared with these, so new default sources appear once and removed ones stay removed.
  let OLD: Record<Lang, string[]> = {
    ko: ["kr-community", "kr-blog", "kr-qna", "video", "kr-wiki", "forums", "kr-papers", "kr-gov", "kr-law",
      "kr-no-blog", "kr-no-news", "kr-no-namu"],
    ja: ["jp-forums", "jp-blogs", "jp-dev", "forums", "reddit", "video", "social", "papers", "wiki", "no-pinterest"],
    en: ["forums", "reddit", "dev", "docs", "papers", "video", "social", "reviews", "wiki", "blogs", "gov",
      "no-pinterest", "no-news"],
  };
  let REPLACED: Record<string, string> = { "kr-video": "video", "jp-video": "video" };

  function addNew(shown: string[], known: string[], d: { shown: string[] }): string[] {
    let out = shown.slice();
    d.shown.forEach(function (id) {
      if (known.indexOf(id) >= 0 || out.indexOf(id) >= 0) return;
      let old = REPLACED[id] ? out.indexOf(REPLACED[id]) : -1;
      if (old >= 0) { out[old] = id; return; }
      // The user had the old source and removed it: keep it removed instead of adding its replacement.
      if (REPLACED[id] && known.indexOf(REPLACED[id]) >= 0) return;
      let at = out.findIndex(function (x) { return /(^|-)no-/.test(x); });
      if (at < 0 || /(^|-)no-/.test(id)) out.push(id); else out.splice(at, 0, id);
    });
    return out;
  }

  function lang(): Lang {
    let l = (typeof navigator !== "undefined" && navigator.language || "en").toLowerCase();
    if (l.indexOf("ko") === 0) return "ko";
    if (l.indexOf("ja") === 0) return "ja";
    return "en";
  }

  function defaults(): State {
    let d = DEFAULTS[lang()];
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

  function arr(x: unknown): unknown[] | null { return Array.isArray(x) ? x : null; }

  // A list of unique strings, or null when the stored value is not a list. Anything else in it is dropped.
  function strs(x: unknown): string[] | null {
    if (!Array.isArray(x)) return null;
    return x.filter(function (v, i): v is string { return typeof v === "string" && x.indexOf(v) === i; });
  }

  function sanitize(raw: unknown): State {
    let d = defaults();
    if (!raw || typeof raw !== "object") return d;
    let s = raw as Record<string, unknown>;
    let known = strs(s.known) || OLD[lang()];
    return {
      v: 2,
      shown: strs(s.shown) ? addNew(strs(s.shown) as string[], known, d) : d.shown,
      known: known.concat(d.shown.filter(function (id) { return known.indexOf(id) < 0; })),
      active: strs(s.active) || d.active,
      off: strs(s.off) || [],
      extra: strs(s.extra) || [],
      custom: ((arr(s.custom) as CustomLens[] | null) || []).filter(function (l) {
        return l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.sites);
      }).map(function (l) {
        // A site entry without a text domain would break every later read of the lens.
        return Object.assign({}, l, { sites: l.sites.filter(function (x) { return x && typeof x.domain === "string"; }) });
      }),
      engine: (["google", "bing", "duckduckgo", "brave"] as unknown[]).indexOf(s.engine) >= 0 ? (s.engine as EngineId) : "google",
      period: (["", "d", "w", "m", "y"] as unknown[]).indexOf(s.period) >= 0 ? (s.period as Period) : "",
      forums: !!s.forums,
      multi: !!s.multi,
    };
  }

  // Synchronous read for the web app's redirect page, which must not wait.
  function readLocal(): State {
    try { return sanitize(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) { return defaults(); }
  }

  function load(): Promise<State> {
    if (ext) {
      return new Promise<State>(function (resolve) {
        chrome.storage.local.get(KEY, function (r) { resolve(sanitize(r && r[KEY])); });
      });
    }
    return Promise.resolve(readLocal());
  }

  function save(state: State): Promise<void> {
    if (ext) {
      let o: Record<string, State> = {};
      o[KEY] = state;
      return new Promise<void>(function (resolve) { chrome.storage.local.set(o, resolve); });
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep working without saving */ }
    return Promise.resolve();
  }

  function onChange(fn: (state: State) => void): void {
    if (ext && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && changes[KEY]) fn(sanitize(changes[KEY].newValue));
      });
    }
  }

  // Built-in lenses plus the user's own, with custom lenses first.
  function allLenses(state: State): Lens[] {
    let builtin = root.SOURCE_LENSES || [];
    return state.custom.map(function (l): Lens { return Object.assign({ region: "custom", mode: "include" as LensMode }, l); }).concat(builtin);
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

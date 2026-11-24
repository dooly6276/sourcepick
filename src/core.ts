// Query building shared by the web app, the extension pages and the content script.
// Plain script (no modules) so it can be loaded by content scripts and <script> tags alike.
(function (root: typeof globalThis) {
  "use strict";

  let ENGINES: Record<string, Engine> = {
    google: {
      name: "Google",
      // Words after the 32nd are ignored without notice; OR does not count (measured 2026-11).
      maxTerms: 32,
      url: "https://www.google.com/search",
      period: { param: "tbs", values: { d: "qdr:d", w: "qdr:w", m: "qdr:m", y: "qdr:y" } },
      forums: { param: "udm", value: "18" },
      keep: ["tbs", "udm", "hl", "gl", "lr", "safe", "tbm"],
    },
    bing: {
      name: "Bing",
      // 60 sites still kept every result on the chosen site. Up to 1,777 characters gave a full page
      // of results; at 1,822 Bing returned only four (measured 2026-11-24).
      maxTerms: 60,
      maxLength: { size: 1750, unit: "chars" },
      url: "https://www.bing.com/search",
      // Bing has presets for a day, a week and a month; a year is a custom range in days since 1970.
      period: { param: "filters", values: { d: 'ex1:"ez1"', w: 'ex1:"ez2"', m: 'ex1:"ez3"', y: function (now: number) {
        let today = Math.floor(now / 86400000);
        return 'ex1:"ez5_' + (today - 365) + "_" + today + '"';
      } } },
      keep: ["filters", "setlang", "cc", "mkt", "safesearch"],
    },
    duckduckgo: {
      name: "DuckDuckGo",
      maxTerms: 22,
      // Longer queries fall back to the home page. Counted in UTF-8 bytes: 493 worked, 505 did not.
      maxLength: { size: 490, unit: "bytes" },
      url: "https://duckduckgo.com/",
      period: { param: "df", values: { d: "d", w: "w", m: "m", y: "y" } },
      keep: ["df", "kl", "ia", "iax", "kp"],
    },
    brave: {
      name: "Brave",
      // The 21st word is ignored; past about 400 characters it shows "query is too long" (2026-11).
      maxTerms: 20,
      maxLength: { size: 395, unit: "chars" },
      url: "https://search.brave.com/search",
      period: { param: "tf", values: { d: "pd", w: "pw", m: "pm", y: "py" } },
      keep: ["tf", "source", "country", "lang"],
    },
  };

  let PERIODS: Period[] = ["", "d", "w", "m", "y"];

  // "https://www.Example.com/a?b" -> "example.com/a". Returns null when it is not a domain.
  // Bare suffixes such as "gov" or "go.kr" are allowed so lenses can target a whole TLD.
  function normalizeDomain(input: unknown): string | null {
    if (input == null) return null;
    let s = String(input).trim();
    s = s.replace(/^-?site:/i, "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    s = s.split(/[?#\s]/)[0].replace(/\/+$/, "");
    let slash = s.indexOf("/");
    let host = (slash >= 0 ? s.slice(0, slash) : s).toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    let rest = slash >= 0 ? s.slice(slash) : "";
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host) || host.length > 253) return null;
    if (!/[a-z]/.test(host.split(".").pop() as string)) return null;
    if (rest && !/^(\/[A-Za-z0-9._~%-]+)+$/.test(rest)) rest = "";
    return host + rest;
  }

  // A site: or -site: token, possibly wrapped in the parentheses people type around a group of them.
  function isFilterToken(t: string): boolean { return /^\(*-?site:\S+?\)*$/i.test(t); }

  // Removes unmatched parentheses left behind when a filter group such as "(foo site:a.com)" was cut out.
  function balanceParens(s: string): string {
    let open: number[] = [], drop: Record<number, boolean> = {};
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") open.push(i);
      else if (s[i] === ")") { if (open.length) open.pop(); else drop[i] = true; }
    }
    open.forEach(function (i) { drop[i] = true; });
    return s.split("").filter(function (_, i) { return !drop[i]; }).join("").replace(/\s+/g, " ").trim();
  }

  // Removes site: and -site: filters (and the ORs that join them) so a lens can be re-applied.
  // "apple OR site:a.com OR pear" keeps the user's own OR: "apple OR pear".
  function stripFilters(q: string | null | undefined): string {
    let tokens = String(q || "").trim().split(/\s+/).filter(Boolean);
    let isOr = function (t: string) { return t === "OR" || t === "|"; };
    let out: string[] = [], hadParens = false;
    let i = 0;
    while (i < tokens.length) {
      let t = tokens[i];
      if (!isFilterToken(t) && !isOr(t)) { out.push(t); i++; continue; }
      // A run of filters and ORs: find where it ends and whether it holds a filter at all.
      let j = i, hasFilter = false;
      while (j < tokens.length && (isFilterToken(tokens[j]) || isOr(tokens[j]))) {
        if (isFilterToken(tokens[j])) { hasFilter = true; if (/[()]/.test(tokens[j])) hadParens = true; }
        j++;
      }
      let run = tokens.slice(i, j);
      if (!hasFilter) { if (out.length) out.push.apply(out, run); }
      else if (isOr(run[0]) && isOr(run[run.length - 1]) && out.length && j < tokens.length) out.push(run[0]);
      i = j;
    }
    let r = out.join(" ");
    return hadParens ? balanceParens(r) : r;
  }

  function parseFilters(q: string | null | undefined): Filters {
    let include: string[] = [], exclude: string[] = [];
    String(q || "").split(/\s+/).forEach(function (t) {
      let m = t.replace(/^\(+/, "").replace(/\)+$/, "").match(/^(-?)site:(\S+)$/i);
      if (!m) return;
      let d = normalizeDomain(m[2]);
      if (!d) return;
      (m[1] ? exclude : include).push(d);
    });
    return { include: include, exclude: exclude };
  }

  function uniq(list: (string | null | undefined)[] | null | undefined): string[] {
    let seen: Record<string, boolean> = Object.create(null), out: string[] = [];
    (list || []).forEach(function (x) { if (x && !seen[x]) { seen[x] = true; out.push(x); } });
    return out;
  }

  // Excluding a domain that is also included would hide the included one, so drop such pairs.
  function buildQuery(text: string, include: string[], exclude: string[]): string {
    let inc = uniq(include);
    let exc = uniq(exclude).filter(function (d) { return inc.indexOf(d) < 0; });
    let parts: string[] = [];
    let base = stripFilters(text);
    if (base) parts.push(base);
    if (inc.length) parts.push(inc.map(function (d) { return "site:" + d; }).join(" OR "));
    if (exc.length) parts.push(exc.map(function (d) { return "-site:" + d; }).join(" "));
    return parts.join(" ");
  }

  // Words the engine counts toward its limit: everything but OR and the site filters.
  function countWords(text: string): number {
    return stripFilters(text).split(/\s+/).filter(function (t) { return t && t !== "OR" && t !== "|"; }).length;
  }

  // Is domain d inside site s ("blog.naver.com" is inside "naver.com", "a.com/x/y" inside "a.com/x")?
  function within(d: string, s: string): boolean {
    return d === s || d.slice(-(s.length + 1)) === "." + s || d.indexOf(s + "/") === 0 ||
      (d.indexOf("/") > 0 && within(d.split("/")[0], s) && s.indexOf("/") < 0);
  }

  function sizeOf(q: string, unit: "chars" | "bytes"): number {
    if (unit !== "bytes") return q.length;
    return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(q).length : unescape(encodeURIComponent(q)).length;
  }

  function tooLong(text: string, include: string[], exclude: string[], eng: Engine): boolean {
    let m = eng.maxLength;
    return !!m && sizeOf(buildQuery(text, include, exclude), m.unit) > m.size;
  }

  // True when a query is close enough to the engine's length limit that the next site would not fit.
  function nearLength(q: string, engine?: string): boolean {
    let m = (ENGINES[engine || ""] || ENGINES.google).maxLength;
    return !!m && sizeOf(String(q || ""), m.unit) > m.size - 40;
  }

  // Fits the filters into the engine's word and length limits so nothing is dropped silently.
  // With sites to search, an excluded site only matters when it sits inside one of them.
  // Returns { include, exclude, cut: { include: [...], exclude: [...] }, limit }.
  function fit(text: string, include: string[], exclude: string[], engine: string | undefined): FitResult {
    let eng = ENGINES[engine || ""] || ENGINES.google;
    let inc = uniq(include);
    let exc = uniq(exclude).filter(function (d) { return inc.indexOf(d) < 0; });
    if (inc.length) exc = exc.filter(function (d) { return inc.some(function (s) { return within(d, s); }); });
    let room = Math.max(1, eng.maxTerms - countWords(text));
    let incFit = inc.slice(0, room);
    let excFit = exc.slice(0, Math.max(0, room - incFit.length));
    while (excFit.length && tooLong(text, incFit, excFit, eng)) excFit = excFit.slice(0, -1);
    let byLength = incFit.length + excFit.length < Math.min(room, inc.length + exc.length);
    while (incFit.length > 1 && tooLong(text, incFit, excFit, eng)) { incFit = incFit.slice(0, -1); byLength = true; }
    return {
      byLength: byLength,
      include: incFit,
      exclude: excFit,
      cut: { include: inc.slice(incFit.length), exclude: exc.slice(excFit.length) },
      limit: eng.maxTerms,
    };
  }

  // Which period key a results page uses, from the value of the engine's period parameter.
  function periodKey(engine: string, value: string | null | undefined): Period {
    let eng = ENGINES[engine];
    if (!eng || !value) return "";
    let now = Date.now();
    return (Object.keys(eng.period.values) as ("d" | "w" | "m" | "y")[]).filter(function (k) {
      let v = eng.period.values[k];
      if (typeof v !== "function") return v === value;
      // A date-based value (Bing's year) names today's date, so a page opened earlier still counts.
      for (let back = -1; back <= 60; back++) if (v(now - back * 86400000) === value) return true;
      return false;
    })[0] || "";
  }

  // opts: { engine, period, forums, keepFrom (URLSearchParams of the current results page) }
  function searchUrl(text: string, include: string[], exclude: string[], opts?: SearchOptions): string {
    let o = opts || {};
    let eng = ENGINES[o.engine || ""] || ENGINES.google;
    let f = fit(text, include, exclude, o.engine);
    let params = new URLSearchParams();
    params.set("q", buildQuery(text, f.include, f.exclude));
    if (o.keepFrom) {
      let from = o.keepFrom;
      eng.keep.forEach(function (k) { let v = from.get(k); if (v) params.set(k, v); });
    }
    if (o.period !== undefined) {
      let pv = o.period && eng.period.values[o.period];
      if (typeof pv === "function") pv = pv(o.now || Date.now());
      if (pv) params.set(eng.period.param, pv);
      else if (o.period === "") params.delete(eng.period.param);
    }
    if (eng.forums && o.forums !== undefined) {
      if (o.forums) params.set(eng.forums.param, eng.forums.value);
      else if (params.get(eng.forums.param) === eng.forums.value) params.delete(eng.forums.param);
    }
    return eng.url + "?" + params.toString();
  }

  function lensDomains(lens: { sites: Site[] }): string[] { return lens.sites.map(function (s) { return s.domain; }); }

  // How much of a lens a query applies: "all", "part" (its first sites, when the query is at the
  // engine's limit and the rest were cut) or "none". Used by the results-page bar.
  function lensState(q: string, lens: LensSites, engine?: string): LensApplied {
    let f = parseFilters(q);
    let pool = lens.mode === "exclude" ? f.exclude : f.include;
    let ds = lensDomains(lens);
    let n = ds.filter(function (d) { return pool.indexOf(d) >= 0; }).length;
    if (!ds.length || !n) return "none";
    if (n === ds.length) return "all";
    let eng = ENGINES[engine || ""] || ENGINES.google;
    let full = countWords(q) + f.include.length + f.exclude.length >= eng.maxTerms || nearLength(q, engine);
    return full && ds.slice(0, n).every(function (d) { return pool.indexOf(d) >= 0; }) ? "part" : "none";
  }

  function activeLensIds(q: string, lenses: LensRef[], engine?: string): string[] {
    return lenses.filter(function (l) { return lensState(q, l, engine) !== "none"; }).map(function (l) { return l.id; });
  }

  // Turns a set of active lens ids into include/exclude lists, minus sites the user switched off.
  function collect(lenses: LensRef[], ids: string[], off?: string[], extra?: string[]): Filters {
    let include: string[] = [], exclude: string[] = [];
    lenses.forEach(function (l) {
      if (ids.indexOf(l.id) < 0) return;
      lensDomains(l).forEach(function (d) {
        if ((off || []).indexOf(d) >= 0) return;
        (l.mode === "exclude" ? exclude : include).push(d);
      });
    });
    (extra || []).forEach(function (d) { include.push(d); });
    return { include: uniq(include), exclude: uniq(exclude) };
  }

  function lensName(lens: { id?: string; name?: string | LocalizedName }, lang: string): string {
    let n = lens.name || ({} as Partial<LocalizedName>);
    if (typeof n === "string") return n;
    return (n as Record<string, string | undefined>)[lang] || n.en || (lens.id as string);
  }

  // Share links carry a lens as base64url JSON: { n: name, m: mode, s: [domains] }.
  function encodeLens(lens: LensLike): string {
    let data = { n: typeof lens.name === "string" ? lens.name : lensName(lens, "en"), m: lens.mode === "exclude" ? "x" : "i", s: lensDomains(lens) };
    let bytes = new TextEncoder().encode(JSON.stringify(data));
    let bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeLens(code: string): SharedLens | null {
    try {
      let b64 = String(code).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      let bin = atob(b64);
      let bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      let data = JSON.parse(new TextDecoder().decode(bytes));
      let name = (typeof data.n === "string" ? data.n : "").trim().slice(0, 40);
      // An entry with spaces in it is not a domain; normalizeDomain alone would keep its first word.
      let sites = uniq((Array.isArray(data.s) ? data.s : []).map(function (x: unknown) {
        return typeof x === "string" && !/\s/.test(x.trim()) ? normalizeDomain(x) : null;
      })).slice(0, 60);
      if (!name || !sites.length) return null;
      return { name: name, mode: data.m === "x" ? "exclude" : "include", sites: sites.map(function (d) { return { domain: d }; }) };
    } catch (e) {
      return null;
    }
  }

  root.SourceCore = {
    ENGINES: ENGINES,
    PERIODS: PERIODS,
    normalizeDomain: normalizeDomain,
    stripFilters: stripFilters,
    parseFilters: parseFilters,
    buildQuery: buildQuery,
    countWords: countWords,
    fit: fit,
    searchUrl: searchUrl,
    periodKey: periodKey,
    lensState: lensState,
    nearLength: nearLength,
    activeLensIds: activeLensIds,
    collect: collect,
    lensName: lensName,
    lensDomains: lensDomains,
    encodeLens: encodeLens,
    decodeLens: decodeLens,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

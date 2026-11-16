// Query building shared by the web app, the extension pages and the content script.
// Plain script (no modules) so it can be loaded by content scripts and <script> tags alike.
(function (root) {
  "use strict";

  var ENGINES = {
    google: {
      name: "Google",
      url: "https://www.google.com/search",
      period: { param: "tbs", values: { d: "qdr:d", w: "qdr:w", m: "qdr:m", y: "qdr:y" } },
      forums: { param: "udm", value: "18" },
      keep: ["tbs", "udm", "hl", "gl", "lr", "safe", "tbm"],
    },
    duckduckgo: {
      name: "DuckDuckGo",
      url: "https://duckduckgo.com/",
      period: { param: "df", values: { d: "d", w: "w", m: "m", y: "y" } },
      keep: ["df", "kl", "ia", "iax", "kp"],
    },
    brave: {
      name: "Brave Search",
      url: "https://search.brave.com/search",
      period: { param: "tf", values: { d: "pd", w: "pw", m: "pm", y: "py" } },
      keep: ["tf", "source", "country", "lang"],
    },
  };

  var PERIODS = ["", "d", "w", "m", "y"];

  // "https://www.Example.com/a?b" -> "example.com/a". Returns null when it is not a domain.
  // Bare suffixes such as "gov" or "go.kr" are allowed so lenses can target a whole TLD.
  function normalizeDomain(input) {
    if (input == null) return null;
    var s = String(input).trim();
    s = s.replace(/^-?site:/i, "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    s = s.split(/[?#\s]/)[0].replace(/\/+$/, "");
    var slash = s.indexOf("/");
    var host = (slash >= 0 ? s.slice(0, slash) : s).toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    var rest = slash >= 0 ? s.slice(slash) : "";
    if (!/^(?:[a-z0-9-]+\.)*[a-z0-9-]+$/.test(host) || host.length > 253) return null;
    if (!/[a-z]/.test(host.split(".").pop())) return null;
    if (rest && !/^(\/[A-Za-z0-9._~%-]+)+$/.test(rest)) rest = "";
    return host + rest;
  }

  function isFilterToken(t) { return /^-?site:\S+$/i.test(t); }

  // Removes site: and -site: filters (and the ORs that join them) so a lens can be re-applied.
  function stripFilters(q) {
    var tokens = String(q || "").trim().split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (isFilterToken(t)) continue;
      if (t === "OR" || t === "|") {
        var prev = tokens[i - 1], next = tokens[i + 1];
        if ((prev && isFilterToken(prev)) || (next && isFilterToken(next)) || !out.length) continue;
      }
      out.push(t);
    }
    return out.join(" ");
  }

  function parseFilters(q) {
    var include = [], exclude = [];
    String(q || "").split(/\s+/).forEach(function (t) {
      var m = t.match(/^(-?)site:(\S+)$/i);
      if (!m) return;
      var d = normalizeDomain(m[2]);
      if (!d) return;
      (m[1] ? exclude : include).push(d);
    });
    return { include: include, exclude: exclude };
  }

  function uniq(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (x) { if (x && !seen[x]) { seen[x] = true; out.push(x); } });
    return out;
  }

  // Excluding a domain that is also included would hide the included one, so drop such pairs.
  function buildQuery(text, include, exclude) {
    var inc = uniq(include);
    var exc = uniq(exclude).filter(function (d) { return inc.indexOf(d) < 0; });
    var parts = [];
    var base = stripFilters(text);
    if (base) parts.push(base);
    if (inc.length) parts.push(inc.map(function (d) { return "site:" + d; }).join(" OR "));
    if (exc.length) parts.push(exc.map(function (d) { return "-site:" + d; }).join(" "));
    return parts.join(" ");
  }

  // opts: { engine, period, forums, keepFrom (URLSearchParams of the current results page) }
  function searchUrl(text, include, exclude, opts) {
    var o = opts || {};
    var eng = ENGINES[o.engine] || ENGINES.google;
    var params = new URLSearchParams();
    params.set("q", buildQuery(text, include, exclude));
    if (o.keepFrom) {
      eng.keep.forEach(function (k) { var v = o.keepFrom.get(k); if (v) params.set(k, v); });
    }
    if (o.period !== undefined) {
      if (o.period && eng.period.values[o.period]) params.set(eng.period.param, eng.period.values[o.period]);
      else if (o.period === "") params.delete(eng.period.param);
    }
    if (eng.forums && o.forums !== undefined) {
      if (o.forums) params.set(eng.forums.param, eng.forums.value);
      else if (params.get(eng.forums.param) === eng.forums.value) params.delete(eng.forums.param);
    }
    return eng.url + "?" + params.toString();
  }

  function lensDomains(lens) { return lens.sites.map(function (s) { return s.domain; }); }

  // Which lenses are fully applied in a query (used by the results-page bar).
  function activeLensIds(q, lenses) {
    var f = parseFilters(q);
    return lenses.filter(function (l) {
      var pool = l.mode === "exclude" ? f.exclude : f.include;
      return l.sites.length && lensDomains(l).every(function (d) { return pool.indexOf(d) >= 0; });
    }).map(function (l) { return l.id; });
  }

  // Turns a set of active lens ids into include/exclude lists, minus sites the user switched off.
  function collect(lenses, ids, off, extra) {
    var include = [], exclude = [];
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

  function lensName(lens, lang) {
    var n = lens.name || {};
    if (typeof n === "string") return n;
    return n[lang] || n.en || lens.id;
  }

  // Share links carry a lens as base64url JSON: { n: name, m: mode, s: [domains] }.
  function encodeLens(lens) {
    var data = { n: typeof lens.name === "string" ? lens.name : lensName(lens, "en"), m: lens.mode === "exclude" ? "x" : "i", s: lensDomains(lens) };
    var bytes = new TextEncoder().encode(JSON.stringify(data));
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeLens(code) {
    try {
      var b64 = String(code).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var data = JSON.parse(new TextDecoder().decode(bytes));
      var name = String(data.n || "").trim().slice(0, 40);
      var sites = uniq((Array.isArray(data.s) ? data.s : []).map(normalizeDomain)).slice(0, 60);
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
    searchUrl: searchUrl,
    activeLensIds: activeLensIds,
    collect: collect,
    lensName: lensName,
    lensDomains: lensDomains,
    encodeLens: encodeLens,
    decodeLens: decodeLens,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

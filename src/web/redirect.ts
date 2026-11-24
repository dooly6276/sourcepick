// Address-bar searches (?q=) and Android share-sheet searches (?text=) go straight to the search
// engine without drawing the page. Params: l lens ids, s extra/include domains, x exclude domains,
// e engine, p period (d w m y), f=1 Google Forums tab. Without l/s/x the saved selection is used.
(function () {
  "use strict";
  let params = new URLSearchParams(location.search);
  let q = params.get("q");
  if (q === null) {
    let shared = params.get("text") || params.get("title") || "";
    if (!shared && !params.has("text") && !params.has("title")) return;
    q = shared.replace(/\s*https?:\/\/\S+\s*/g, " ").trim() || params.get("url") || "";
  }
  q = q.trim();
  if (!q) return;

  let core = window.SourceCore;
  let store = window.SourceStore;
  let state = store.readLocal();
  let lenses = store.allLenses(state);
  let hasSpec = params.has("l") || params.has("s") || params.has("x");
  let list = function (k: string): string[] { return (params.get(k) || "").split(",").map(core.normalizeDomain).filter(Boolean) as string[]; };

  let include: string[], exclude: string[], opts: SearchOptions;
  if (hasSpec) {
    let ids = (params.get("l") || "").split(",").filter(Boolean);
    let c = core.collect(lenses, ids, [], list("s"));
    include = c.include;
    exclude = c.exclude.concat(list("x"));
    opts = { engine: params.get("e") || "google", period: (params.get("p") || "") as Period, forums: params.get("f") === "1" };
  } else {
    let s = core.collect(lenses, state.active, state.off, state.extra);
    include = s.include;
    exclude = s.exclude;
    opts = { engine: state.engine, period: state.period, forums: state.engine === "google" && state.forums };
  }
  if (core.PERIODS.indexOf(opts.period as Period) < 0) opts.period = "";

  window.__sourcepickRedirecting = true;
  document.documentElement.style.visibility = "hidden";
  location.replace(core.searchUrl(q, include, exclude, opts));
})();

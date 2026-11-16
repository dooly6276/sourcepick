// Address-bar searches (?q=) and Android share-sheet searches (?text=) go straight to the search
// engine without drawing the page. Params: l lens ids, s extra/include domains, x exclude domains,
// e engine, p period (d w m y), f=1 Google Forums tab. Without l/s/x the saved selection is used.
(function () {
  "use strict";
  var params = new URLSearchParams(location.search);
  var q = params.get("q");
  if (q === null) {
    var shared = params.get("text") || params.get("title") || "";
    if (!shared && !params.has("text") && !params.has("title")) return;
    q = shared.replace(/\s*https?:\/\/\S+\s*/g, " ").trim() || params.get("url") || "";
  }
  q = q.trim();
  if (!q) return;

  var core = window.SourceCore;
  var store = window.SourceStore;
  var state = store.readLocal();
  var lenses = store.allLenses(state);
  var hasSpec = params.has("l") || params.has("s") || params.has("x");
  var list = function (k) { return (params.get(k) || "").split(",").map(core.normalizeDomain).filter(Boolean); };

  var include, exclude, opts;
  if (hasSpec) {
    var ids = (params.get("l") || "").split(",").filter(Boolean);
    var c = core.collect(lenses, ids, [], list("s"));
    include = c.include;
    exclude = c.exclude.concat(list("x"));
    opts = { engine: params.get("e") || "google", period: params.get("p") || "", forums: params.get("f") === "1" };
  } else {
    var s = core.collect(lenses, state.active, state.off, state.extra);
    include = s.include;
    exclude = s.exclude;
    opts = { engine: state.engine, period: state.period, forums: state.engine === "google" && state.forums };
  }
  if (core.PERIODS.indexOf(opts.period) < 0) opts.period = "";

  window.__sourcepickRedirecting = true;
  document.documentElement.style.visibility = "hidden";
  location.replace(core.searchUrl(q, include, exclude, opts));
})();

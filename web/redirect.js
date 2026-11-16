// 주소창 검색엔진으로 등록한 주소(?q=...)로 들어오면 화면을 그리지 않고 바로 구글로 보낸다.
// g: 묶음 id(쉼표), s: 추가 도메인(쉼표), p: 기간(d,w,m,y), n=1: 언론사 기사 제외, f=1: 포럼 탭.
(function () {
  "use strict";
  var params = new URLSearchParams(location.search);
  var q = params.get("q");
  if (q === null) return;
  var core = window.SourceCore;
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem("sourcepick:v1") || "{}") || {}; } catch (e) { saved = {}; }
  var custom = Array.isArray(saved.customGroups) ? saved.customGroups : [];
  var all = core.GROUPS.concat(custom);
  var hasSpec = params.has("g") || params.has("s");

  var sites = [];
  if (hasSpec) {
    var ids = (params.get("g") || "").split(",").filter(Boolean);
    all.forEach(function (g) {
      if (ids.indexOf(g.id) >= 0) g.sites.forEach(function (s) { sites.push(s[0]); });
    });
    (params.get("s") || "").split(",").forEach(function (d) {
      var n = core.normalizeDomain(d);
      if (n) sites.push(n);
    });
  } else {
    var selected = saved.groups || ["community"];
    var off = saved.disabled || [];
    all.forEach(function (g) {
      if (selected.indexOf(g.id) < 0) return;
      g.sites.forEach(function (s) { if (off.indexOf(s[0]) < 0) sites.push(s[0]); });
    });
    (saved.extra || []).forEach(function (d) { sites.push(d); });
  }

  var opts = hasSpec
    ? { period: params.get("p") || "", excludeNews: params.get("n") === "1", forums: params.get("f") === "1" }
    : { period: saved.period || "", excludeNews: !!saved.excludeNews, forums: !!saved.forums };
  if (!/^[dwmy]?$/.test(opts.period)) opts.period = "";

  window.__sourcepickRedirecting = true;
  document.documentElement.style.visibility = "hidden";
  location.replace(core.googleUrl(q, sites, opts));
})();

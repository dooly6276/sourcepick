// 구글 검색 결과 화면의 탭 아래에 출처 버튼 줄을 넣는다.
// 버튼을 선택하면 검색어 끝의 site: 조건을 바꿔 다시 검색한다. 상태는 주소(q)에만 있다.
(function () {
  "use strict";
  if (document.getElementById("sourcepick-bar")) return;
  var core = globalThis.SourceCore;
  if (!core) return;

  var url = new URL(location.href);
  var q = url.searchParams.get("q") || "";
  if (!q) return;

  var current = core.extractSites(q);
  var siteSet = {};
  current.sites.forEach(function (s) { siteSet[s] = true; });

  function groupOn(g) {
    return g.sites.length > 0 && g.sites.every(function (s) { return siteSet[s[0]]; });
  }

  function go(sites, excludeNews) {
    var next = new URL(location.origin + location.pathname);
    next.searchParams.set("q", core.buildQuery(q, sites, { excludeNews: excludeNews }));
    ["tbs", "udm", "hl", "gl", "lr", "safe"].forEach(function (k) {
      var v = url.searchParams.get(k);
      if (v) next.searchParams.set(k, v);
    });
    location.assign(next.toString());
  }

  function toggleGroup(g) {
    var on = groupOn(g);
    var sites = current.sites.slice();
    var ids = g.sites.map(function (s) { return s[0]; });
    if (on) sites = sites.filter(function (s) { return ids.indexOf(s) < 0; });
    else ids.forEach(function (s) { if (sites.indexOf(s) < 0) sites.push(s); });
    go(sites, current.excludeNews);
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

  var bar = document.createElement("div");
  bar.id = "sourcepick-bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "출처 선택");

  var label = document.createElement("span");
  label.className = "sp-label";
  label.textContent = "출처";
  bar.appendChild(label);

  core.GROUPS.forEach(function (g) {
    bar.appendChild(button(g.name, groupOn(g), function () { toggleGroup(g); }));
  });

  var sep = document.createElement("span");
  sep.className = "sp-sep";
  bar.appendChild(sep);
  bar.appendChild(button("언론사 기사 제외", current.excludeNews, function () {
    go(current.sites, !current.excludeNews);
  }));
  if (current.sites.length || current.excludeNews) {
    bar.appendChild(button("조건 해제", null, function () { go([], false); }, "sp-clear"));
  }

  // 결과 목록 왼쪽 끝에 맞춘다. 구글 화면 구조가 바뀌어 자리를 못 찾으면 화면 하단에 띄운다.
  function align() {
    var col = document.getElementById("center_col") || document.getElementById("rso");
    var host = bar.parentElement;
    if (!col || !host || bar.classList.contains("sp-fixed")) return;
    var left = col.getBoundingClientRect().left - host.getBoundingClientRect().left;
    bar.style.paddingLeft = Math.max(16, Math.round(left)) + "px";
  }

  var anchor = document.getElementById("appbar");
  var cnt = document.getElementById("cnt");
  if (anchor && anchor.parentElement) {
    anchor.parentElement.insertBefore(bar, anchor);
  } else if (cnt) {
    cnt.insertBefore(bar, cnt.firstChild);
  } else {
    bar.classList.add("sp-fixed");
    document.body.appendChild(bar);
  }
  align();
  window.addEventListener("resize", align);
})();

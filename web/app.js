(function () {
  "use strict";
  if (window.__sourcepickRedirecting) return;

  var core = window.SourceCore;
  var KEY = "sourcepick:v1";
  var $ = function (id) { return document.getElementById(id); };

  // 상태: groups 선택한 묶음 id, disabled 묶음 안에서 해제한 도메인, extra 직접 추가한 도메인,
  // customGroups 내 묶음, period 기간, excludeNews 언론사 기사 제외, forums 포럼 탭.
  var state = load();

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { s = {}; }
    return {
      groups: Array.isArray(s.groups) ? s.groups : ["community"],
      disabled: Array.isArray(s.disabled) ? s.disabled : [],
      extra: Array.isArray(s.extra) ? s.extra : [],
      customGroups: Array.isArray(s.customGroups) ? s.customGroups : [],
      period: typeof s.period === "string" ? s.period : "",
      excludeNews: !!s.excludeNews,
      forums: !!s.forums,
    };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 저장이 막힌 브라우저에서도 화면은 그대로 쓴다 */ }
  }

  function allGroups() { return core.GROUPS.concat(state.customGroups); }

  function selectedGroups() {
    return allGroups().filter(function (g) { return state.groups.indexOf(g.id) >= 0; });
  }

  function activeSites() {
    var out = [];
    selectedGroups().forEach(function (g) {
      g.sites.forEach(function (s) {
        if (state.disabled.indexOf(s[0]) < 0 && out.indexOf(s[0]) < 0) out.push(s[0]);
      });
    });
    state.extra.forEach(function (d) { if (out.indexOf(d) < 0) out.push(d); });
    return out;
  }

  function opts() {
    return { period: state.period, excludeNews: state.excludeNews, forums: state.forums };
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  // 출처 묶음 버튼
  function renderGroups() {
    var box = $("groups");
    box.textContent = "";
    allGroups().forEach(function (g) {
      var on = state.groups.indexOf(g.id) >= 0;
      box.appendChild(el("button", {
        type: "button",
        class: "group-btn" + (on ? " is-on" : ""),
        "aria-pressed": on ? "true" : "false",
        onclick: function () { toggleGroup(g.id); },
      }, [
        el("span", { class: "group-name", text: g.name }),
        el("span", { class: "group-num", text: String(g.sites.length) }),
      ]));
    });
  }

  function toggleGroup(id) {
    var i = state.groups.indexOf(id);
    if (i >= 0) state.groups.splice(i, 1);
    else state.groups.push(id);
    save();
    renderAll();
  }

  // 사이트 편집: 선택한 묶음의 사이트별 체크, 추가한 사이트, 내 묶음 삭제
  function renderSiteList() {
    var box = $("site-list");
    box.textContent = "";
    var groups = selectedGroups();
    if (!groups.length && !state.extra.length) {
      box.appendChild(el("p", { class: "desc", text: "선택한 출처가 없습니다. 출처를 선택하거나 사이트를 추가해 주세요." }));
    }
    groups.forEach(function (g) {
      var isCustom = g.id.indexOf("my-") === 0;
      var head = el("div", { class: "list-head" }, [el("h3", { text: g.name })]);
      if (isCustom) {
        head.appendChild(el("button", {
          type: "button", class: "btn-text danger", text: "묶음 삭제",
          onclick: function () { deleteCustomGroup(g); },
        }));
      }
      var ul = el("ul", { class: "site-rows" });
      g.sites.forEach(function (s) {
        var on = state.disabled.indexOf(s[0]) < 0;
        var input = el("input", { type: "checkbox" });
        input.checked = on;
        input.addEventListener("change", function () { toggleSite(s[0], input.checked); });
        ul.appendChild(el("li", null, [el("label", { class: "site-row" }, [
          input,
          el("span", { class: "site-name", text: s[1] }),
          el("span", { class: "site-domain", text: s[0] }),
        ])]));
      });
      box.appendChild(el("div", { class: "list-group" }, [head, ul]));
    });
    if (state.extra.length) {
      var ul2 = el("ul", { class: "site-rows" });
      state.extra.forEach(function (d) {
        ul2.appendChild(el("li", { class: "site-row" }, [
          el("span", { class: "site-name", text: d }),
          el("button", {
            type: "button", class: "btn-text danger", text: "삭제", "aria-label": d + " 삭제",
            onclick: function () { removeExtra(d); },
          }),
        ]));
      });
      box.appendChild(el("div", { class: "list-group" }, [
        el("div", { class: "list-head" }, [el("h3", { text: "추가한 사이트" })]), ul2,
      ]));
    }
  }

  function toggleSite(domain, on) {
    var i = state.disabled.indexOf(domain);
    if (on && i >= 0) state.disabled.splice(i, 1);
    if (!on && i < 0) state.disabled.push(domain);
    save();
    renderSummary();
    renderPerSite();
    renderEngineUrl();
  }

  function removeExtra(d) {
    state.extra = state.extra.filter(function (x) { return x !== d; });
    save();
    renderAll();
  }

  function deleteCustomGroup(g) {
    if (!window.confirm("'" + g.name + "' 묶음을 삭제하시겠습니까?")) return;
    state.customGroups = state.customGroups.filter(function (x) { return x.id !== g.id; });
    state.groups = state.groups.filter(function (id) { return id !== g.id; });
    save();
    renderAll();
  }

  function renderSummary() {
    var n = activeSites().length;
    $("site-count").textContent = n
      ? "선택한 사이트 " + n + "개"
      : "선택한 사이트가 없습니다. 웹 전체에서 검색합니다.";
    $("clear-groups").hidden = !state.groups.length && !state.extra.length;
  }

  function renderPeriod() {
    var box = $("period");
    Array.prototype.slice.call(box.querySelectorAll("label")).forEach(function (n) { n.remove(); });
    core.PERIODS.forEach(function (p) {
      var input = el("input", { type: "radio", name: "period", value: p[0] });
      input.checked = state.period === p[0];
      input.addEventListener("change", function () {
        state.period = p[0];
        save();
        renderPerSite();
        renderEngineUrl();
      });
      box.appendChild(el("label", { class: "seg" }, [input, el("span", { text: p[1] })]));
    });
  }

  // 검색어를 입력하면 사이트 하나씩 검색하는 링크를 보여 준다. 한 사이트가 결과를 다 차지할 때 쓴다.
  function renderPerSite() {
    var q = $("q").value.trim();
    var sites = activeSites();
    var sec = $("per-site");
    var ul = $("per-site-list");
    ul.textContent = "";
    if (!q || sites.length < 2) { sec.hidden = true; return; }
    sec.hidden = false;
    $("per-site-count").textContent = sites.length + "개";
    sites.forEach(function (d) {
      ul.appendChild(el("li", null, [el("a", {
        href: core.googleUrl(q, [d], opts()), target: "_blank", rel: "noopener",
      }, [
        el("span", { class: "site-name", text: core.siteName(d, state.customGroups) }),
        el("span", { class: "site-domain", text: d }),
      ])]));
    });
  }

  function engineUrl() {
    var base = location.origin + location.pathname.replace(/index\.html$/, "");
    var p = [];
    if (state.groups.length) p.push("g=" + state.groups.join(","));
    var extra = state.extra.slice();
    // 묶음에서 해제한 사이트가 있으면 묶음 id 대신 사이트를 하나씩 적어야 그대로 검색된다.
    var hasDisabled = selectedGroups().some(function (g) {
      return g.sites.some(function (s) { return state.disabled.indexOf(s[0]) >= 0; });
    });
    var hasCustom = state.groups.some(function (id) { return id.indexOf("my-") === 0; });
    if (hasDisabled || hasCustom) { p = []; extra = activeSites(); }
    if (extra.length) p.push("s=" + extra.join(","));
    if (!p.length) p.push("s=");
    if (state.period) p.push("p=" + state.period);
    if (state.excludeNews) p.push("n=1");
    if (state.forums) p.push("f=1");
    p.push("q=%s");
    return base + "?" + p.join("&");
  }

  function renderEngineUrl() { $("engine-url").textContent = engineUrl(); }

  function renderAll() {
    renderGroups();
    renderSummary();
    renderSiteList();
    renderPerSite();
    renderEngineUrl();
  }

  // 이벤트
  $("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("q").value.trim();
    if (!q) { $("q").focus(); return; }
    window.open(core.googleUrl(q, activeSites(), opts()), "_blank", "noopener");
  });

  $("q").addEventListener("input", renderPerSite);

  $("clear-groups").addEventListener("click", function () {
    state.groups = [];
    state.extra = [];
    save();
    renderAll();
  });

  $("edit-toggle").addEventListener("click", function () {
    var ed = $("editor");
    ed.hidden = !ed.hidden;
    this.setAttribute("aria-expanded", ed.hidden ? "false" : "true");
    this.textContent = ed.hidden ? "사이트 편집" : "편집 완료";
  });

  function showError(id, msg) {
    var n = $(id);
    n.textContent = msg || "";
    n.hidden = !msg;
  }

  $("add-site-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("add-site");
    var d = core.normalizeDomain(input.value);
    if (!d) { showError("add-site-error", "도메인 형식이 올바르지 않습니다. 예: theqoo.net"); return; }
    showError("add-site-error", "");
    var i = state.disabled.indexOf(d);
    if (i >= 0) state.disabled.splice(i, 1);
    if (activeSites().indexOf(d) < 0) state.extra.push(d);
    input.value = "";
    save();
    renderAll();
  });

  $("save-group-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("group-name");
    var name = input.value.trim();
    var sites = activeSites();
    if (!name) { showError("save-group-error", "묶음 이름을 입력해 주세요."); return; }
    if (!sites.length) { showError("save-group-error", "저장할 사이트가 없습니다. 출처를 선택하거나 사이트를 추가해 주세요."); return; }
    showError("save-group-error", "");
    var id = "my-" + Date.now().toString(36);
    state.customGroups.push({
      id: id,
      name: name,
      sites: sites.map(function (d) { return [d, core.siteName(d, state.customGroups)]; }),
    });
    state.groups = [id];
    state.extra = [];
    input.value = "";
    save();
    renderAll();
  });

  $("exclude-news").checked = state.excludeNews;
  $("exclude-news").addEventListener("change", function () {
    state.excludeNews = this.checked; save(); renderPerSite(); renderEngineUrl();
  });
  $("forums").checked = state.forums;
  $("forums").addEventListener("change", function () {
    state.forums = this.checked; save(); renderPerSite(); renderEngineUrl();
  });

  $("copy-engine").addEventListener("click", function () {
    var text = engineUrl();
    var done = function () {
      $("copy-done").hidden = false;
      setTimeout(function () { $("copy-done").hidden = true; }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  });

  function fallbackCopy(text) {
    var ta = el("textarea", { readonly: "" });
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* 복사가 막히면 주소를 직접 선택해 복사한다 */ }
    ta.remove();
  }

  renderPeriod();
  renderAll();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();

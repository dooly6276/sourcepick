(function () {
  "use strict";
  if (window.__sourcepickRedirecting) return;

  var core = window.SourceCore;
  var store = window.SourceStore;
  var i18n = window.SourceI18n;
  var t = i18n.t;
  var LANG = i18n.lensLang;
  var $ = function (id) { return document.getElementById(id); };
  var isPopup = document.body.classList.contains("popup");
  var isExt = store.isExtension;

  var state = null;
  var pendingImport = null;

  // ---------- helpers ----------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function lenses() { return store.allLenses(state); }
  function byId(id) { return lenses().filter(function (l) { return l.id === id; })[0]; }
  function name(l) { return core.lensName(l, LANG); }
  function shownLenses(mode) {
    return state.shown.map(byId).filter(function (l) { return l && (!mode || l.mode === mode); });
  }

  function persist() { return store.save(state); }

  function current() { return core.collect(lenses(), state.active, state.off, state.extra); }

  function opts() {
    return { engine: state.engine, period: state.period, forums: state.engine === "google" && state.forums };
  }

  function showMsg(id, msg) {
    var n = $(id);
    n.textContent = msg || "";
    n.hidden = !msg;
  }

  function flash(id, msg) {
    showMsg(id, msg);
    clearTimeout(flash[id]);
    flash[id] = setTimeout(function () { showMsg(id, ""); }, 2500);
  }

  function siteLabel(domain) {
    var found = null;
    lenses().some(function (l) {
      return l.sites.some(function (s) { if (s.domain === domain && s.name) { found = s.name; return true; } return false; });
    });
    return found || domain;
  }

  function openUrl(url) {
    if (isExt && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: url });
      if (isPopup) window.close();
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  // ---------- main view ----------
  function renderGrid() {
    var box = $("lens-grid");
    box.textContent = "";
    shownLenses("include").forEach(function (l) {
      var on = state.active.indexOf(l.id) >= 0;
      box.appendChild(el("button", {
        type: "button",
        class: "lens-btn" + (on ? " is-on" : ""),
        "aria-pressed": on ? "true" : "false",
        onclick: function () { toggleActive(l.id); },
      }, [el("span", { class: "lens-name", text: name(l) }), el("span", { class: "lens-num", text: String(l.sites.length) })]));
    });
    if (!box.children.length) box.appendChild(el("p", { class: "desc", text: t("noShown") }));
  }

  function toggleActive(id) {
    var i = state.active.indexOf(id);
    if (i >= 0) state.active.splice(i, 1);
    else state.active.push(id);
    persist();
    renderMain();
  }

  function renderSummary() {
    var c = current();
    var n = c.include.length;
    $("site-count").textContent = n ? t("siteCount", n) : t("siteCountNone");
    $("clear").hidden = !state.active.length && !state.extra.length;
  }

  function renderEditor() {
    var box = $("site-list");
    box.textContent = "";
    var active = state.active.map(byId).filter(function (l) { return l && l.mode === "include"; });
    if (!active.length && !state.extra.length) box.appendChild(el("p", { class: "desc", text: t("editorEmpty") }));
    active.forEach(function (l) {
      var ul = el("ul", { class: "site-rows" });
      l.sites.forEach(function (s) {
        var input = el("input", { type: "checkbox" });
        input.checked = state.off.indexOf(s.domain) < 0;
        input.addEventListener("change", function () { toggleOff(s.domain, !input.checked); });
        ul.appendChild(el("li", null, [el("label", { class: "site-row" }, [
          input, el("span", { class: "site-name", text: s.name || s.domain }), el("span", { class: "site-domain", text: s.domain }),
        ])]));
      });
      box.appendChild(el("div", { class: "list-group" }, [el("h3", { class: "list-head", text: name(l) }), ul]));
    });
    if (state.extra.length) {
      var ul2 = el("ul", { class: "site-rows" });
      state.extra.forEach(function (d) {
        ul2.appendChild(el("li", { class: "site-row" }, [
          el("span", { class: "site-name", text: d }),
          el("button", { type: "button", class: "btn-text danger", text: t("delete"), "aria-label": t("deleteSite", d), onclick: function () { removeExtra(d); } }),
        ]));
      });
      box.appendChild(el("div", { class: "list-group" }, [el("h3", { class: "list-head", text: t("addedSites") }), ul2]));
    }
  }

  function toggleOff(domain, off) {
    var i = state.off.indexOf(domain);
    if (off && i < 0) state.off.push(domain);
    if (!off && i >= 0) state.off.splice(i, 1);
    persist();
    renderSummary(); renderPerSite(); renderEngineUrl();
  }

  function removeExtra(d) {
    state.extra = state.extra.filter(function (x) { return x !== d; });
    persist();
    renderMain();
  }

  function renderSegmented(boxId, items, value, onPick) {
    var box = $(boxId);
    Array.prototype.slice.call(box.querySelectorAll("label")).forEach(function (n) { n.remove(); });
    items.forEach(function (it) {
      var input = el("input", { type: "radio", name: boxId, value: it[0] });
      input.checked = value === it[0];
      input.addEventListener("change", function () { onPick(it[0]); });
      box.appendChild(el("label", { class: "seg" }, [input, el("span", { text: it[1] })]));
    });
  }

  function renderOptions() {
    renderSegmented("engine", Object.keys(core.ENGINES).map(function (k) { return [k, core.ENGINES[k].name]; }), state.engine, function (v) {
      state.engine = v; persist(); renderOptions(); renderPerSite(); renderEngineUrl();
    });
    renderSegmented("period", core.PERIODS.map(function (p) { return [p, t("period_" + (p || "all"))]; }), state.period, function (v) {
      state.period = v; persist(); renderPerSite(); renderEngineUrl();
    });
    var box = $("exclude-list");
    box.textContent = "";
    shownLenses("exclude").forEach(function (l) {
      var input = el("input", { type: "checkbox" });
      input.checked = state.active.indexOf(l.id) >= 0;
      input.addEventListener("change", function () { toggleActive(l.id); });
      box.appendChild(el("label", { class: "check" }, [input, el("span", { text: name(l) })]));
    });
    $("forums-row").hidden = state.engine !== "google";
    $("forums").checked = state.forums;
  }

  function renderPerSite() {
    var q = $("q").value.trim();
    var c = current();
    var sec = $("per-site");
    var ul = $("per-site-list");
    ul.textContent = "";
    if (!q || c.include.length < 2) { sec.hidden = true; return; }
    sec.hidden = false;
    $("per-site-count").textContent = t("count", c.include.length);
    c.include.forEach(function (d) {
      ul.appendChild(el("li", null, [el("a", {
        href: core.searchUrl(q, [d], c.exclude, opts()), target: "_blank", rel: "noopener",
        onclick: function (e) { if (isExt) { e.preventDefault(); openUrl(this.href); } },
      }, [el("span", { class: "site-name", text: siteLabel(d) }), el("span", { class: "site-domain", text: d })])]));
    });
  }

  // Address-bar URL: lens ids when nothing was switched off, otherwise the explicit site list.
  function engineUrl() {
    var base = location.origin + location.pathname.replace(/index\.html$/, "");
    var p = [];
    var custom = state.active.some(function (id) { return id.indexOf("my-") === 0; });
    var hasOff = state.active.map(byId).some(function (l) {
      return l && l.sites.some(function (s) { return state.off.indexOf(s.domain) >= 0; });
    });
    if (custom || hasOff) {
      var c = current();
      p.push("s=" + c.include.join(","));
      if (c.exclude.length) p.push("x=" + c.exclude.join(","));
    } else {
      p.push("l=" + state.active.join(","));
      if (state.extra.length) p.push("s=" + state.extra.join(","));
    }
    if (state.engine !== "google") p.push("e=" + state.engine);
    if (state.period) p.push("p=" + state.period);
    if (state.engine === "google" && state.forums) p.push("f=1");
    p.push("q=%s");
    return base + "?" + p.join("&");
  }

  function renderEngineUrl() {
    if (!isExt) $("engine-url").textContent = engineUrl();
  }

  function renderMain() {
    renderGrid();
    renderSummary();
    renderEditor();
    renderOptions();
    renderPerSite();
    renderEngineUrl();
  }

  // ---------- manage view ----------
  var REGION_ORDER = ["custom", "kr", "jp", "global"];

  function renderManage() {
    var box = $("manage-list");
    box.textContent = "";
    var all = lenses();
    REGION_ORDER.forEach(function (region) {
      var list = all.filter(function (l) { return l.region === region; });
      if (!list.length) return;
      var ul = el("ul", { class: "manage-rows" });
      list.forEach(function (l) {
        var shown = state.shown.indexOf(l.id) >= 0;
        var input = el("input", { type: "checkbox", "aria-label": t("showLens", name(l)) });
        input.checked = shown;
        input.addEventListener("change", function () { setShown(l.id, input.checked); });
        var title = name(l);
        if (l.mode === "exclude" && title.toLowerCase().indexOf(t("modeExcludeShort").toLowerCase()) < 0) title += " (" + t("modeExcludeShort") + ")";
        var info = el("div", { class: "manage-info" }, [
          el("span", { class: "site-name", text: title }),
          el("span", { class: "manage-sites", text: sitesSummary(l) }),
        ]);
        var row = el("li", { class: "manage-row" }, [el("label", { class: "manage-main" }, [input, info])]);
        if (region === "custom") {
          row.appendChild(el("div", { class: "manage-actions" }, [
            el("button", { type: "button", class: "btn-text", text: t("copyLink"), onclick: function () { copyShare(l); } }),
            el("button", { type: "button", class: "btn-text", text: t("edit"), onclick: function () { startEdit(l); } }),
            el("button", { type: "button", class: "btn-text danger", text: t("delete"), onclick: function () { deleteLens(l); } }),
          ]));
        }
        ul.appendChild(row);
      });
      box.appendChild(el("div", { class: "list-group" }, [el("h3", { class: "list-head", text: t("region_" + region) }), ul]));
    });
  }

  // Site names when they tell the sites apart, domains otherwise; long lists are cut short.
  function sitesSummary(l) {
    var names = l.sites.map(function (s) { return s.name || s.domain; });
    var distinct = names.filter(function (n, i) { return names.indexOf(n) === i; }).length === names.length;
    var list = distinct ? names : l.sites.map(function (s) { return s.domain; });
    var MAX = 8;
    return list.length > MAX ? list.slice(0, MAX).join(", ") + " " + t("andMore", list.length - MAX) : list.join(", ");
  }

  function setShown(id, on) {
    var i = state.shown.indexOf(id);
    if (on && i < 0) state.shown.push(id);
    if (!on && i >= 0) {
      state.shown.splice(i, 1);
      state.active = state.active.filter(function (x) { return x !== id; });
    }
    persist();
  }

  function shareUrl(l) {
    var base = window.SOURCEPICK_WEB_URL || (location.origin + location.pathname.replace(/index\.html$/, ""));
    return base + "#add=" + core.encodeLens(l);
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }

  function fallbackCopy(text) {
    var ta = el("textarea", { readonly: true });
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* the link stays selectable on screen */ }
    ta.remove();
  }

  function copyShare(l) {
    copyText(shareUrl(l), function () { flash("manage-done", t("linkCopied")); });
  }

  function parseSites(text) {
    var good = [], bad = [];
    String(text || "").split(/[\s,]+/).filter(Boolean).forEach(function (raw) {
      var d = core.normalizeDomain(raw);
      if (d) { if (good.indexOf(d) < 0) good.push(d); } else bad.push(raw);
    });
    return { good: good, bad: bad };
  }

  function addCustom(lens) {
    var id = "my-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    state.custom.push({ id: id, name: lens.name, mode: lens.mode, sites: lens.sites.map(function (s) { return { domain: s.domain }; }) });
    state.shown.unshift(id);
    return id;
  }

  function startEdit(l) {
    $("edit-id").value = l.id;
    $("new-name").value = l.name;
    document.querySelector('input[name="new-mode"][value="' + l.mode + '"]').checked = true;
    $("new-sites").value = l.sites.map(function (s) { return s.domain; }).join("\n");
    $("new-submit").textContent = t("saveChanges");
    $("new-cancel").hidden = false;
    $("h-new").textContent = t("editLens");
    $("h-new").scrollIntoView({ behavior: "smooth", block: "start" });
    $("new-name").focus({ preventScroll: true });
  }

  function resetForm() {
    $("new-lens-form").reset();
    $("edit-id").value = "";
    $("new-submit").textContent = t("saveLens");
    $("new-cancel").hidden = true;
    $("h-new").textContent = t("newLens");
    showMsg("new-error", "");
  }

  function deleteLens(l) {
    if (!window.confirm(t("confirmDelete", l.name))) return;
    state.custom = state.custom.filter(function (x) { return x.id !== l.id; });
    state.shown = state.shown.filter(function (x) { return x !== l.id; });
    state.active = state.active.filter(function (x) { return x !== l.id; });
    persist();
    renderManage();
    flash("manage-done", t("deleted"));
  }

  // ---------- routing ----------
  function route() {
    var hash = location.hash;
    if (hash.indexOf("#add=") === 0) {
      pendingImport = core.decodeLens(hash.slice(5));
      history.replaceState(null, "", location.pathname + location.search);
      hash = "";
    }
    var manage = hash === "#manage";
    $("view-main").hidden = manage;
    $("view-manage").hidden = !manage;
    if (manage) { renderManage(); window.scrollTo(0, 0); }
    else { renderMain(); renderImportCard(); }
  }

  function renderImportCard() {
    var card = $("import-card");
    if (!pendingImport) { card.hidden = true; return; }
    $("import-text").textContent = t("importAsk", pendingImport.name, pendingImport.sites.length);
    card.hidden = false;
  }

  // ---------- events ----------
  function bind() {
    $("search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = $("q").value.trim();
      if (!q) { $("q").focus(); return; }
      var c = current();
      openUrl(core.searchUrl(q, c.include, c.exclude, opts()));
    });
    $("q").addEventListener("input", renderPerSite);

    $("clear").addEventListener("click", function () {
      state.active = state.active.filter(function (id) { var l = byId(id); return l && l.mode === "exclude"; });
      state.extra = [];
      persist();
      renderMain();
    });

    $("open-manage").addEventListener("click", function (e) {
      if (isPopup && chrome.runtime && chrome.runtime.openOptionsPage) {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
        window.close();
      }
    });

    $("edit-toggle").addEventListener("click", function () {
      var ed = $("editor");
      ed.hidden = !ed.hidden;
      this.setAttribute("aria-expanded", ed.hidden ? "false" : "true");
      this.textContent = ed.hidden ? t("editSites") : t("editDone");
    });

    $("add-site-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var d = core.normalizeDomain($("add-site").value);
      if (!d) { showMsg("add-site-error", t("badDomain")); return; }
      showMsg("add-site-error", "");
      var i = state.off.indexOf(d);
      if (i >= 0) state.off.splice(i, 1);
      if (current().include.indexOf(d) < 0) state.extra.push(d);
      $("add-site").value = "";
      persist();
      renderMain();
    });

    $("save-lens-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nm = $("save-lens-name").value.trim();
      var c = current();
      if (!nm) { showMsg("save-lens-error", t("needName")); return; }
      if (!c.include.length) { showMsg("save-lens-error", t("needSites")); return; }
      showMsg("save-lens-error", "");
      var id = addCustom({ name: nm, mode: "include", sites: c.include.map(function (d) { return { domain: d }; }) });
      state.active = state.active.filter(function (x) { var l = byId(x); return l && l.mode === "exclude"; });
      state.active.push(id);
      state.extra = [];
      $("save-lens-name").value = "";
      persist();
      renderMain();
    });

    $("forums").addEventListener("change", function () {
      state.forums = this.checked; persist(); renderPerSite(); renderEngineUrl();
    });

    $("copy-engine").addEventListener("click", function () {
      copyText(engineUrl(), function () { flash("copy-done", t("copied")); });
    });

    $("import-add").addEventListener("click", function () {
      if (!pendingImport) return;
      var id = addCustom(pendingImport);
      if (pendingImport.mode === "include") {
        state.active = state.active.filter(function (x) { var l = byId(x); return l && l.mode === "exclude"; });
      }
      state.active.push(id);
      pendingImport = null;
      persist();
      renderMain();
      renderImportCard();
    });
    $("import-close").addEventListener("click", function () { pendingImport = null; renderImportCard(); });

    $("new-lens-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nm = $("new-name").value.trim();
      var mode = document.querySelector('input[name="new-mode"]:checked').value;
      var parsed = parseSites($("new-sites").value);
      if (!nm) { showMsg("new-error", t("needName")); return; }
      if (parsed.bad.length) { showMsg("new-error", t("badDomains", parsed.bad.slice(0, 3).join(", "))); return; }
      if (!parsed.good.length) { showMsg("new-error", t("needSitesManage")); return; }
      var sites = parsed.good.map(function (d) { return { domain: d }; });
      var editId = $("edit-id").value;
      if (editId) {
        state.custom.forEach(function (l) { if (l.id === editId) { l.name = nm; l.mode = mode; l.sites = sites; } });
      } else {
        addCustom({ name: nm, mode: mode, sites: sites });
      }
      persist();
      resetForm();
      renderManage();
      flash("manage-done", editId ? t("changesSaved") : t("lensSaved"));
    });
    $("new-cancel").addEventListener("click", resetForm);

    $("import-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("import-link").value.trim();
      var m = v.match(/#add=([A-Za-z0-9_-]+)/);
      var lens = core.decodeLens(m ? m[1] : v);
      if (!lens) { showMsg("import-error", t("badLink")); return; }
      showMsg("import-error", "");
      addCustom(lens);
      $("import-link").value = "";
      persist();
      renderManage();
      flash("manage-done", t("lensAdded", lens.name));
    });

    $("reset").addEventListener("click", function () {
      if (!window.confirm(t("confirmReset"))) return;
      state = store.defaults();
      persist();
      resetForm();
      renderManage();
      flash("manage-done", t("resetDone"));
    });

    window.addEventListener("hashchange", route);
    store.onChange(function (s) {
      state = s;
      if ($("view-manage").hidden) renderMain(); else renderManage();
    });
  }

  // ---------- start ----------
  i18n.apply(document);
  if (isExt) {
    $("bar-web").hidden = true;
    $("bar-ext").hidden = false;
    $("way-phone").hidden = true;
    $("way-ext").hidden = true;
  }
  if (!isExt && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) $("way-phone").open = false;

  store.load().then(function (s) {
    state = s;
    // Drop ids of lenses that no longer exist (renamed or removed in an update).
    var ids = lenses().map(function (l) { return l.id; });
    state.shown = state.shown.filter(function (id) { return ids.indexOf(id) >= 0; });
    state.active = state.active.filter(function (id) { return ids.indexOf(id) >= 0; });
    bind();
    route();
    if (!isPopup && !pendingImport && $("view-manage").hidden && matchMedia("(min-width: 700px)").matches) $("q").focus();
    if (isPopup) $("q").focus();
  });

  if (!isExt && "serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();

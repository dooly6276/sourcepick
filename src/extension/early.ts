// Runs before the results page draws. When the query carries site: filters, the search box text is
// hidden until content.js has replaced it with the words alone, so the long query does not flash.
// content.js removes the style; if it never runs, the timeout shows the box as it was.
(function () {
  "use strict";
  let q = "";
  try { q = new URL(location.href).searchParams.get("q") || ""; } catch (e) { return; }
  if (!/(^|\s)-?site:\S/i.test(q) || document.getElementById("sourcepick-hide")) return;
  let style = document.createElement("style");
  style.id = "sourcepick-hide";
  style.textContent = 'textarea[name="q"], input[name="q"]:not([type="hidden"]) { color: transparent !important; -webkit-text-fill-color: transparent !important; }';
  let root = document.head || document.documentElement;
  if (root) root.appendChild(style);
  else {
    // Some browsers run this before the <html> element exists.
    let wait = new MutationObserver(function () {
      if (!document.documentElement) return;
      wait.disconnect();
      document.documentElement.appendChild(style);
    });
    wait.observe(document, { childList: true });
  }
  setTimeout(function () { style.remove(); }, 2500);
})();

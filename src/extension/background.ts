// Opens the settings page for the results-page bar and handles "sp <query>" in the address bar.
if (typeof importScripts === "function" && !self.SourceCore) {
  importScripts("lenses.js", "core.js", "store.js", "i18n.js");
}

chrome.runtime.onMessage.addListener(function (msg: { type?: string } | undefined) {
  if (msg && msg.type === "openOptions") chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener(function (details: chrome.runtime.InstalledDetails) {
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});

function selectedUrl(text: string): Promise<string> {
  return self.SourceStore.load().then(function (state: State) {
    let core = self.SourceCore;
    let c = core.collect(self.SourceStore.allLenses(state), state.active, state.off, state.extra);
    return core.searchUrl(text, c.include, c.exclude, {
      engine: state.engine, period: state.period, forums: state.engine === "google" && state.forums,
    });
  });
}

if (chrome.omnibox) {
  chrome.omnibox.onInputEntered.addListener(function (text: string, disposition: "currentTab" | "newForegroundTab" | "newBackgroundTab") {
    text = String(text || "").trim();
    if (!text) return;
    selectedUrl(text).then(function (url: string) {
      if (disposition === "currentTab") chrome.tabs.update({ url: url });
      else chrome.tabs.create({ url: url, active: disposition === "newForegroundTab" });
    });
  });
}

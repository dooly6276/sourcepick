# Changelog

## Unreleased

- When two copies of the extension are installed (for example the store version and a developer copy), the results page shows one source bar instead of two.
- The source is now TypeScript (strict). The built web app and extensions behave the same as before.
- Ten new Korean sources: Video (Naver TV, Chzzk, SOOP), News, Shopping, Reviews, Statistics, Universities, Courses, Jobs, Secondhand and Bookstores. Public bodies, wikis and encyclopedias, law, papers, worldwide forums, video, wikis and government, and the Japanese sources list more sites. New default sources are added once to settings saved earlier; sources you removed stay removed.
- Bing is supported: the web app can search it, and the extension adds the source buttons to Bing results. Bing kept 60 sites in our tests, so large sources fit whole.
- Google is the default engine and the main screen no longer shows an engine picker. Bing, DuckDuckGo and Brave are under Manage sources, and the search options summary names the engine only when it is not Google.
- Edit sites shows how many sites of each source are on, with Select all to turn them back on, and Share selected sites copies a link that adds the sites in use as a source.
- Korean sources gain Exclude blogs and Exclude Namuwiki, which replace Exclude Pinterest in the Korean defaults. The add-site example is danawa.com.
- The extension's settings page and popup no longer log a Content Security Policy error in Chrome. Links shared from the extension now point to the web app instead of a chrome-extension:// address, and the install guide link shows again.

## 0.3.1

- Searches are also trimmed to DuckDuckGo's and Brave's length limits (about 500 bytes and 400 characters). Long custom sources used to get an error page or the DuckDuckGo home page.
- Brave applies 20 words and sites, not 18, so more sites fit.
- Samsung Internet install steps start with the install button in the address bar.
- iPad no longer shows the address-bar tip meant for computers.

## 0.3.0

- Searches now fit each engine's word limit (Google 32, DuckDuckGo about 22, Brave about 18, measured November 2026). Before, long source lists were cut off by the engine without notice. The app now says how many sites are searched when they do not all fit.
- Choosing a source selects only that source. Turn on *Choose several sources*, or hold Ctrl, Cmd or Shift, to combine them.
- *Search one site at a time* moved right under the sources, as buttons.
- Address-bar search follows the sources selected last instead of the ones selected when the address was copied.
- New source button on the main screen; shared links show their sites before adding and are not added twice; regions in Manage are collapsible.
- Results-page bar: one scrollable row, works on Google's phone layout (Firefox for Android), 44 px buttons on touch screens.
- Japanese interface.
- The *No major news* sources were trimmed to 16 sites so they fit every engine.

## 0.2.0

- Sources as JSON files with 35 built-in sources for worldwide, Korean and Japanese sites.
- Web app that installs on phones and receives text from the Android share sheet.
- Chrome and Firefox extension with buttons on Google, DuckDuckGo and Brave Search result pages, and the `sp` address-bar keyword.
- Your own sources, shareable as links.

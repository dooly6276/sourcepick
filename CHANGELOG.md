# Changelog

## Unreleased

- With sources chosen, the results page search box and tab title show only your words, not the long `site:` list. Searching again from that box (Enter, the search button or a suggestion) keeps the chosen sources; Clear or the source buttons change them. Works on Google, Bing, DuckDuckGo and Brave.
- Results-page bar fixes: it sits above the results on Google Images, no longer covers Bing's result count, stays at the top of DuckDuckGo results, keeps full-size buttons on Brave phones, and moves Clear and Manage to their own line when a note leaves the sources too little room. The Firefox add-on needs Firefox 140 (142 on Android), the first versions with the data collection setting.
- Worldwide and Japanese sources are rebuilt by kind of site, like the Korean ones. Worldwide gains Q&A, News, Shopping, Statistics & data, Law, Online courses, Jobs & careers, Secondhand and Books, plus No Quora and No shopping; Forums, Reviews, Wikis, Papers, Blogs, Travel and Recipes list many more sites. Japan gains Q&A, Video, Wikis and dictionaries, News, Shopping, Reviews, Secondhand, Papers, Government, Law, Jobs, Books and Recipes, plus No matome sites, No Yahoo! Chiebukuro and No Japanese news. English and Japanese defaults show the new sources (added once to settings saved earlier).
- Opening the popup over a results page searched without sources keeps your saved sources and the sites you turned off, and the first press of a selected source applies it to that search.
- Manage sources has a Source order list with up and down buttons, so the source buttons can be put in any order.
- The web app keeps the last search in the box when you come back from the results, so it is easy to change and search again.
- Back in Manage sources returns to the main screen without adding a history step, so the browser's back button no longer reopens Manage.
- Adding a site rejects text with spaces and single words that are not a domain ending ("hello world" used to add "hello"); go.kr, gov and full addresses still work.
- A shared link that cannot be read now says so instead of showing nothing.
- In the popup over a results page, choosing one source drops the sites that came only from that page's query, so the tab searches just that source and those sites are not saved.
- The Samsung Internet steps no longer repeat the Google Play Protect step.
- Repository audit before the public launch. Search filters typed in parentheses, such as `(site:a.com OR site:b.com)`, are replaced instead of stacked, and the user's own `OR` between words is kept when site filters sit next to it. Domains starting or ending a label with a hyphen are rejected. A site named `constructor` is no longer dropped by the duplicate check. Bing's "past year" stays selected on a results page opened on an earlier day. Share links reject site entries with spaces and names that are not text. Saved settings with wrong value types are cleaned up, and a removed Video source does not return as its Korean replacement. Dead address `wiki.hash.kr` (now the wiki at `wiki1.kr`, named 위키원) replaced, sites already covered by `.gov` and `.edu` removed from the worldwide government and university sources, Japanese names added for the Korean sources. Tests grow from 11 to 23. Version 0.4.0, with store listing drafts and a privacy policy in `store/`. The release workflow checks that the tag matches the version.
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

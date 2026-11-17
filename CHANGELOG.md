# Changelog

## 0.3.0

- Searches now fit each engine's word limit (Google 32, DuckDuckGo about 22, Brave 20, measured November 2026) and length limit (DuckDuckGo about 500 bytes, Brave about 400 characters). Before, long source lists were cut off by the engine without notice. The app now says how many sites are searched when they do not all fit.
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

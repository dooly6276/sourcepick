# How Sourcepick works

Sourcepick is plain browser JavaScript with no dependencies and no bundler. One set of files in `src/` runs in three places, and `scripts/build.mjs` copies it into `dist/web`, `dist/chrome` and `dist/firefox`.

```
lenses/*.json ──► scripts/lenses.mjs (validate) ──► dist/*/lenses.js  (globalThis.SOURCE_LENSES)

src/core.js    query building, engine limits, share links      used everywhere
src/store.js   settings: chrome.storage.local or localStorage  used everywhere
src/i18n.js    interface text (en, ko, ja)                     used everywhere
src/app/       main screen and "Manage sources"                web app, extension popup and settings page
src/web/       redirect.js (?q= and share sheet), sw.js, manifest.webmanifest
src/extension/ content.js (results-page buttons), background.js (omnibox "sp"), _locales
```

## The one idea

A **source** (called a lens in the code) is a list of domains with a mode, `include` or `exclude`. Applying sources means rewriting the query with operators every engine understands:

```
query site:a.com OR site:b.com -site:c.com
```

Everything reads state back from the query itself: the results-page bar parses `site:` and `-site:` from the URL (`core.parseFilters`, `core.lensState`), so a results URL is always the full truth and can be bookmarked or shared.

## Engine limits

Search engines silently ignore words past a limit. `core.ENGINES[...].maxTerms` holds what we measured in November 2026 (Google 32, DuckDuckGo about 22, Brave about 18; `OR` does not count). `core.fit()` trims every search to that limit before the URL is built:

1. With sites to include, excluded sites outside them are dropped (results come from the included sites anyway).
2. Included sites come first, then exclusions, in source order.
3. What was cut is returned, and the app tells the user (`limitInclude`, `limitExclude`).

If you measure a different limit, change `maxTerms` and say how you measured it in the pull request.

## Adding a search engine

1. Add an entry to `ENGINES` in `src/core.js`: `name`, `maxTerms`, `url`, the time-filter parameter, and `keep` (URL parameters to carry over when the bar re-runs a search).
2. Add its results-page URL patterns to `CONTENT_MATCHES` in `scripts/build.mjs`.
3. Add a placement function to `PLACE` in `src/extension/content.js` that returns where the bar goes (`parent`, `before`, optional `alignTo`). Test it on desktop and on a phone-sized window; engines often serve a different layout to phones.
4. Add the engine to the `engine` check in `src/store.js` (`sanitize`).
5. Add tests for its URL in `tests/core.test.mjs`.

## Adding an interface language

Copy the `en` block in `src/i18n.js`, translate every value, keep `{0}`-style placeholders, and add the language to the `ui` choice at the bottom. Add `name` entries for that language in the lens files you can, and a default set of sources for new users in `DEFAULTS` in `src/store.js`. The extension store text lives in `src/extension/_locales/<lang>/messages.json`.

## Adding a region

Create `lenses/<code>/`, add the code to `REGIONS` in `scripts/lenses.mjs`, and add `region_<code>` to every language in `src/i18n.js`.

## Testing

`npm test` runs unit tests and validates every lens file. For the screens, run `npm run serve` and try the change in a phone-sized window too. To try the extension, run `npm run build` and load `dist/chrome` (Chrome, Edge, Whale, Brave, Opera: `chrome://extensions`, developer mode, Load unpacked) or `dist/firefox/manifest.json` (Firefox: `about:debugging`, This Firefox, Load Temporary Add-on).

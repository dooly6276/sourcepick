# How Sourcepick works

Sourcepick is strict TypeScript with no runtime dependencies and no bundler. One set of files in `src/` runs in three places. `tsc` compiles each file to a plain script in `.build/` (no modules, so content scripts can load them), and `scripts/build.ts` copies the result into `dist/web`, `dist/chrome` and `dist/firefox`.

```
lenses/*.json ──► scripts/lenses.ts (validate) ──► dist/*/lenses.js  (globalThis.SOURCE_LENSES)

src/core.ts    query building, engine limits, share links      used everywhere
src/store.ts   settings: chrome.storage.local or localStorage  used everywhere
src/i18n.ts    interface text (en, ko, ja)                     used everywhere
src/app/       main screen and "Manage sources"                web app, extension popup and settings page
src/web/       redirect.ts (?q= and share sheet), sw.ts, manifest.webmanifest
src/extension/ content.ts (results-page buttons), background.ts (omnibox "sp"), _locales
src/types.d.ts shared types, and the globals SourceCore, SourceStore, SourceI18n
```

## The one idea

A **source** (called a lens in the code) is a list of domains with a mode, `include` or `exclude`. Applying sources means rewriting the query with operators every engine understands:

```
query site:a.com OR site:b.com -site:c.com
```

Everything reads state back from the query itself: the results-page bar parses `site:` and `-site:` from the URL (`core.parseFilters`, `core.lensState`), so a results URL is always the full truth and can be bookmarked or shared.

## Popup over a results page

When the toolbar popup opens over a Google, Bing, DuckDuckGo or Brave results tab, it asks the content script for that page (`sourcepick:page` message: engine, query, URL parameters). The search box then holds the page's words, the source buttons show the sources applied there, and any change searches that tab again with `chrome.tabs.update`. No extra permission is needed: the content script only runs on results pages, so the message fails quietly everywhere else and the popup opens new tabs as before.

On a results page whose query is made only of sources the bar shows, the content script shows just the typed words in the engine's search box and the tab title (`stripFilters`). Enter, the engine's submit button and its suggestions then search again with the same sources through `core.searchUrl`; a short `sessionStorage` note covers suggestions that navigate without a form submit, and is used once. `early.ts` runs at `document_start` on the same pages and hides the box text until it is cleaned, so the long query does not flash. A site the user typed, or a domain no source explains, leaves the query as it is.

The popup can be at most 600 px tall, so it shows three rows of sources and a "N more" button for the rest, like the results-page bar.

## Engine limits

Search engines silently ignore words past a limit, and some refuse long queries outright. `core.ENGINES[...]` holds what we measured in November 2026:

| Engine | `maxTerms` (words and sites, `OR` not counted) | `maxLength` |
|---|---|---|
| Google | 32 | none needed |
| Bing | 60 (no limit found) | 1,750 characters: 1,777 gave a full page of results, 1,822 only four |
| DuckDuckGo | about 22 | about 500 UTF-8 bytes, then it shows its home page (493 worked, 505 did not) |
| Brave | 20 | about 400 characters, then "Your query is too long" (394 worked, 410 did not) |

`core.fit()` trims every search to both limits before the URL is built:

1. With sites to include, excluded sites outside them are dropped (results come from the included sites anyway).
2. Included sites come first, then exclusions, in source order.
3. If the query is still too long, exclusions and then included sites are dropped from the end until it fits.
4. What was cut is returned with `byLength` when the length limit was the reason, and the app tells the user (`limitInclude`, `limitExclude`, or their `...Length` versions).

If you measure a different limit, change `maxTerms` or `maxLength` and say how you measured it in the pull request. The method we used: a common word, then made-up `site:` domains that have no pages, then `site:reddit.com` last. If Reddit results appear, the last term was applied.

## Address-bar search

The web app answers `?q=` (`src/web/redirect.ts`) with the sources saved in that browser, so any browser that lets you add a custom search engine can use `https://sourcepick.toolnjoy.com/?q=%s`. The page also links `opensearch.xml`. As of November 2026 (Android checked on a Galaxy Note20):

- Desktop Chrome, Edge and Firefox: you can add the address by hand. Firefox also offers it from the OpenSearch link.
- Chrome for Android has no way to add an engine by hand. It lists a site under Settings > Search engine > Recently visited after a real form submission on that site, and only when the form's page has the path `/` (`GenerateKeywordFromNavigationEntry` in `search_engine_tab_helper.cc`). That is why the web app has its own host, and why on phones its search form submits normally (`./?q=`, then `redirect.js`) instead of opening a new tab. The web app shows these steps in Chrome for Android.
- Samsung Internet and iOS Safari only offer a fixed list of engines. On those, the share sheet (Android) and the home-screen app cover this instead.

## Adding a search engine

1. Add an entry to `ENGINES` in `src/core.ts`: `name`, `maxTerms`, `url`, the time-filter parameter, and `keep` (URL parameters to carry over when the bar re-runs a search).
2. Add its results-page URL patterns to `CONTENT_MATCHES` in `scripts/build.ts`.
3. Add a placement function to `PLACE` in `src/extension/content.ts` that returns where the bar goes (`parent`, `before`, optional `alignTo`). Test it on desktop and on a phone-sized window; engines often serve a different layout to phones.
4. Add the engine to `EngineId` in `src/types.d.ts` and to the `engine` check in `src/store.ts` (`sanitize`).
5. Add tests for its URL in `tests/core.test.ts`.

## Adding an interface language

Copy the `en` block in `src/i18n.ts`, translate every value, keep `{0}`-style placeholders, and add the language to the `ui` choice at the bottom. Add `name` entries for that language in the lens files you can, and a default set of sources for new users in `DEFAULTS` in `src/store.ts`. The extension store text lives in `src/extension/_locales/<lang>/messages.json`.

## Adding a region

Create `lenses/<code>/`, add the code to `REGIONS` in `scripts/lenses.ts`, and add `region_<code>` to every language in `src/i18n.ts`.

## Testing

`npm test` compiles `src/` and runs the unit tests (query building, filter parsing, share links, saved-state cleanup) and the checks of every lens file. `npm run typecheck` checks all TypeScript projects without writing files. For the screens, run `npm run serve` and try the change in a phone-sized window too. To try the extension, run `npm run build` and load `dist/chrome` (Chrome, Edge, Whale, Brave, Opera: `chrome://extensions`, developer mode, Load unpacked) or `dist/firefox/manifest.json` (Firefox: `about:debugging`, This Firefox, Load Temporary Add-on).

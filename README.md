# Sourcepick

**Search only the sites you choose.** Forums, Reddit, official docs, papers, Korean communities, Japanese Q&A sites and more, on Google, DuckDuckGo or Brave Search.

[한국어](README.ko.md)

![Sourcepick adds source buttons under the Google search bar. Choosing Reddit narrows the results to Reddit threads.](docs/demo-en.gif)

Search engines bury forum threads, first-hand reviews and primary sources under SEO pages. Typing `site:reddit.com OR site:news.ycombinator.com OR ...` every time works, but nobody wants to. Sourcepick keeps those site lists for you as **sources** and applies them with one click.

- **One click on the results page.** The extension adds a row of source buttons to Google, DuckDuckGo and Brave Search. Combine sources, or turn on exclusions such as *No Pinterest*.
- **35 built-in sources** for worldwide, Korean and Japanese sites, kept as plain JSON files that anyone can improve.
- **Your own sources.** Make a source from any list of domains or URL paths (`reddit.com/r/BuyItForLife` works) and share it as a link.
- **Works on phones too.** Add the web app to your home screen, then share selected text from any Android app to search it with your sources. Tested on Samsung Internet.
- **Address bar.** Type `sp` and a space in the address bar (extension), or register the web app as a search engine.
- **No account, no server, no tracking.** Settings stay in your browser. The only network request is the search itself, sent straight to the engine you picked.

## Install

| Where | How |
|---|---|
| Chrome, Edge, Whale, Brave, Opera | Chrome Web Store (coming soon). For now: build and load `dist/chrome` as an unpacked extension. |
| Firefox (desktop and Android) | Firefox Add-ons (coming soon). For now: build and load `dist/firefox/manifest.json` from `about:debugging`. |
| Any phone or browser | Open the web app and add it to your home screen. |

```bash
git clone <this repository>
cd sourcepick
npm run build        # writes dist/web, dist/chrome, dist/firefox
```

No dependencies. Node 18 or later is enough.

## How it works

A source is a list of sites. Choosing sources rewrites your query with search operators that every major engine understands:

```
mechanical keyboard site:reddit.com OR site:news.ycombinator.com -site:pinterest.com
```

The results page bar reads the operators back from the URL, so the buttons always show what is applied, and the page stays a normal search URL you can bookmark or share. Time filters, Google's Forums tab and other engine settings are kept.

Google applied all 26 `site:` filters joined with `OR` in our tests (November 2026), so large sources work. Bing is not supported yet because it showed a human verification page to our automated tests.

## Built-in sources

| Region | Sources |
|---|---|
| Worldwide | Forums, Reddit, Developers, Official docs, Papers, Video, Social, Product reviews, Wikis, Blogs & newsletters, Open source, Travel, Recipes, Design, Government & public, Universities, No Pinterest, No major news |
| Korea | Communities, Workplace, Naver & Daum cafes, Blogs, KnowledgeiN, Tech & gadgets, Gaming, Developers, Papers, Government, Law, Wikis, Recipes, No Korean news |
| Japan | Forums, Blogs, Developers |

Each one is a file in [`lenses/`](lenses). Missing a great site, or a whole country? See [CONTRIBUTING.md](CONTRIBUTING.md). It takes a JSON file and a pull request.

## Project layout

```
lenses/            built-in sources, one JSON file each (global/, kr/, jp/)
src/core.js        query building for each engine, share links
src/store.js       settings (chrome.storage in the extension, localStorage on the web)
src/i18n.js        interface text (English, Korean)
src/app/           the main screen, shared by the web app, the extension popup and its settings page
src/extension/     results-page bar, background script, store listing text
src/web/           address-bar and share-sheet redirect, service worker, web app manifest
scripts/           build, lens validation, domain check
tests/             node --test
```

```bash
npm test               # unit tests and lens validation
npm run check-domains  # checks that every site in lenses/ still responds (network)
npm run serve          # builds and serves the web app on http://127.0.0.1:8791
npm run package        # builds zip files for the extension stores
```

## Privacy

Sourcepick has no server and collects nothing. The extension asks only for `storage`, plus access to search result pages on Google, DuckDuckGo and Brave Search so it can show the source buttons there.

## License

[MIT](LICENSE)

# Contributing

Thanks for helping! The most useful contribution is a better source: a missing site, a dead site removed, or a whole new region. Translations, engines and browser support are welcome too; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) shows where everything lives.

Not sure where to start? Look for [`good first issue`](https://github.com/dooly6276/sourcepick/labels/good%20first%20issue), or open a [discussion](https://github.com/dooly6276/sourcepick/discussions) to talk an idea through. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Add or improve a source

1. Find the file in `lenses/<region>/` (`global`, `kr`, `jp`), or create a new one. The file name must match its `id`.
2. Follow this shape:

```json
{
  "id": "forums",
  "name": { "en": "Forums", "ko": "해외 포럼", "ja": "海外フォーラム" },
  "mode": "include",
  "order": 10,
  "sites": [
    { "domain": "reddit.com", "name": "Reddit" },
    { "domain": "news.ycombinator.com", "name": "Hacker News" }
  ]
}
```

- `name.en` is required. Add the names you know; the interface shows the visitor's language when it exists.
- `mode` is `include` (search only these sites) or `exclude` (hide these sites).
- `domain` is lowercase, without `https://` or `www.`. A path narrows it (`reddit.com/r/travel`), and a bare suffix covers a whole domain space (`gov`, `go.kr`).
- Prefer sites where people write first-hand: forums, Q&A, reviews, primary sources. Keep a source focused; a dozen strong sites beat fifty weak ones.
- A source can have at most 25 sites (16 for `exclude`). Search engines ignore the end of long queries without saying so: in our November 2026 tests Google applied 32 words and sites, DuckDuckGo about 22 and Brave 20 (`OR` does not count), Bing 60 or more, and DuckDuckGo and Brave also refuse queries longer than about 500 bytes and 400 characters. Sourcepick fits each search to the engine and tells the user when sites are left out, but a source should fit on its own.
- In an `exclude` source, use the narrowest domain that still catches the pages, so a community hosted under a news company's domain is not hidden with it.

3. Check it:

```bash
npm test                       # validates every lens file
npm run check-domains -- <id>  # checks that the sites respond
npm run build                  # then reload the extension or the web app to try it
```

4. Open a pull request. Say in a sentence why each new site belongs.

## A new region

Create `lenses/<code>/`, add the code to `REGIONS` in `scripts/lenses.ts`, and add a default set for that language in `src/store.ts` if it should be shown to new users. Interface translations live in `src/i18n.ts`.

## Code changes

There are no runtime dependencies and no bundler. `src/` is strict TypeScript that `tsc` compiles to plain scripts in `.build/`; `scripts/build.ts` copies them into `dist/`. Run `npm install` once, then `npm run typecheck` and `npm test`.

```bash
npm run serve   # web app on http://127.0.0.1:8791
npm run build   # then load dist/chrome or dist/firefox as an unpacked extension
npm test        # unit tests and lens validation, also run by CI on every pull request
```

Before sending a pull request, run `npm test` and try the change in the web app and the extension, including a phone-sized window. Keep pull requests focused on one thing; small ones get merged quickly.

## Releases

Maintainers bump `version` in `package.json`, add a section to `CHANGELOG.md` and push a `v<version>` tag. The release workflow builds the extension packages and publishes them. Every push to `main` also deploys the web app to GitHub Pages.

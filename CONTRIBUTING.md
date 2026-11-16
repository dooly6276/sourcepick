# Contributing

The most useful contribution is a better source: a missing site, a dead site removed, or a whole new region.

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
- In an `exclude` source, use the narrowest domain that still catches the pages, so a community hosted under a news company's domain is not hidden with it.

3. Check it:

```bash
npm test                       # validates every lens file
npm run check-domains -- <id>  # checks that the sites respond
npm run build                  # then reload the extension or the web app to try it
```

4. Open a pull request. Say in a sentence why each new site belongs.

## A new region

Create `lenses/<code>/`, add the code to `REGIONS` in `scripts/lenses.mjs`, and add a default set for that language in `src/store.js` if it should be shown to new users. Interface translations live in `src/i18n.js`.

## Code changes

There are no dependencies and no bundler. `src/` is plain browser JavaScript; `scripts/build.mjs` copies it into `dist/`. Run `npm test` before sending a pull request, and try the change in both the web app and the extension.

# Firefox Add-ons (AMO) listing

Drafts for addons.mozilla.org. The add-on id is `sourcepick@dooly6276.github.io`. Firefox 121 or later, desktop and Android. The manifest declares `data_collection_permissions: required: ["none"]`. Source code is the repository itself; the build is `npm ci && npm run package`, which writes `dist/sourcepick-firefox-<version>.zip` (Node 24 or later). Reviewers can read the build notes in the README.

Categories: Search Tools, Productivity. License: MIT. Support site: https://github.com/dooly6276/sourcepick/issues. Homepage: https://sourcepick.toolnjoy.com/. Privacy policy: https://github.com/dooly6276/sourcepick/blob/main/store/privacy.md

## Summary (250 characters at most)

English: Search only the sites you choose. Adds source buttons like Forums, Reddit and Papers to Google, Bing, DuckDuckGo and Brave Search results, with 42 built-in sources and your own.

한국어: 원하는 출처의 검색 결과만 볼 수 있습니다. 구글, Bing, DuckDuckGo, Brave 검색 결과 화면에 커뮤니티, 블로그, 논문 같은 출처 버튼을 추가합니다. 기본 출처 42개와 내 출처를 사용할 수 있습니다.

日本語: 選んだサイトの検索結果だけを表示します。Google、Bing、DuckDuckGo、Brave の検索結果ページに、掲示板、ブログ、論文などの検索先ボタンを追加します。標準の検索先 42 件と自分の検索先を使えます。

## Description

Use the same text as the Chrome Web Store listing (`store/chrome-web-store.md`, "Detailed description"). AMO accepts a limited set of HTML tags, so list items can stay as plain lines starting with a dash.

## Notes to reviewers

Sourcepick has no server and sends no data. Content scripts run only on search results pages of Google (country domains listed in the manifest), Bing, DuckDuckGo and Brave Search, to add a button bar and to read the query from the page address. Settings are stored with `storage.local`. There is no remote code, no analytics and no third-party library: the shipped scripts are the TypeScript sources of `src/` compiled by `tsc`, plus `lenses.js`, which `scripts/build.ts` generates from the JSON files in `lenses/`.

## Permission explanations

- `storage`: saves the user's settings in the browser.
- Access to search results pages (content scripts): shows the source buttons and reads the current query so the bar shows which sources are applied.
- Address-bar keyword `sp`: search with the selected sources.

(한국어) 권한은 설정 저장과 검색 결과 화면의 출처 버튼 표시에만 사용하며, 데이터를 수집하거나 전송하지 않습니다.
(日本語) 権限は設定の保存と検索結果ページへの検索先ボタンの表示にだけ使い、データの収集や送信は行いません。

# Chrome Web Store listing

Drafts for the Chrome Web Store dashboard (also usable for Edge Add-ons). Text fields are in English, Korean and Japanese. The short description of each language is the `description` in `src/extension/_locales/<lang>/messages.json` (limit 132 characters), so it is not repeated here.

Category: Productivity (alternative: Search Tools). Privacy policy URL: https://github.com/dooly6276/sourcepick/blob/main/store/privacy.md

## Detailed description

### English

Search only the sites you choose.

Search engines bury forum threads, first-hand reviews and primary sources under SEO pages. Typing `site:reddit.com OR site:news.ycombinator.com ...` works, but nobody wants to do it every time. Sourcepick keeps those site lists as sources and applies them with one click.

- A row of source buttons appears on Google, Bing, DuckDuckGo and Brave Search result pages. Click one to search only those sites. Hold Ctrl or Shift, or turn on "Choose several sources", to combine them.
- 42 built-in sources for worldwide, Korean and Japanese sites: forums, Reddit, official docs, papers, communities, blogs, government sites, law, shopping, reviews and more.
- Exclusion sources such as "No Pinterest" and "No major news" for whole-web searches.
- Search one site at a time when several sites together let one big site fill the page.
- Make your own sources from any list of domains or URL paths, and share them as a link.
- Type "sp" and a space in the address bar to search with your sources.
- Time filters and Google's Forums tab are kept. The results page stays a normal search URL you can bookmark or share.
- Interface in English, Korean and Japanese.

No account, no server and no tracking. Settings stay in your browser, and your search goes only to the engine you picked. Free and open source (MIT): https://github.com/dooly6276/sourcepick

### 한국어

원하는 출처의 검색 결과만 볼 수 있습니다.

구글에서 검색하면 기사와 광고성 글이 상단을 차지해 실제 사용자의 글을 찾기 어렵습니다. `site:dcinside.com OR site:theqoo.net ...`를 매번 입력하면 원하는 결과를 볼 수 있지만 번거롭습니다. Sourcepick은 사이트 목록을 출처로 저장해 두고, 선택 한 번으로 검색에 적용합니다.

- 구글, Bing, DuckDuckGo, Brave 검색 결과 화면에 출처 버튼이 표시됩니다. 버튼을 선택하면 해당 사이트에서만 검색합니다. Ctrl이나 Shift를 누른 채 선택하거나 '여러 출처 함께 선택'을 켜면 여러 출처를 함께 검색합니다.
- 커뮤니티, 블로그, 카페, 논문, 공공기관, 법률, 쇼핑, 리뷰, 해외 포럼, 공식 문서 등 한국, 일본, 해외 사이트를 묶은 기본 출처 42개를 제공합니다.
- 웹 전체를 검색할 때 언론사나 Pinterest 같은 사이트를 제외할 수 있습니다.
- 여러 사이트를 함께 검색해 한 사이트의 결과가 많이 표시되면 사이트별로 따로 검색할 수 있습니다.
- 원하는 사이트나 게시판 주소로 내 출처를 만들고 링크로 공유할 수 있습니다.
- 주소창에 `sp`를 입력하고 스페이스바를 누르면 선택한 출처로 검색합니다.
- 검색 기간과 구글 포럼 탭 설정은 그대로 유지됩니다. 검색 결과 주소는 일반 검색 주소와 같아서 북마크하거나 공유할 수 있습니다.
- 화면 언어는 한국어, 영어, 일본어를 지원합니다.

회원가입, 서버, 추적이 없습니다. 설정은 브라우저에만 저장되고, 검색어는 선택한 검색엔진으로만 전송됩니다. 무료 오픈소스(MIT)입니다. https://github.com/dooly6276/sourcepick

### 日本語

選んだサイトの検索結果だけを表示します。

検索結果の上位は SEO 記事に占められ、掲示板の書き込みや実際の使用感、一次情報が埋もれがちです。`site:5ch.net OR site:chiebukuro.yahoo.co.jp ...` と毎回入力すれば絞り込めますが、手間がかかります。Sourcepick はサイトの一覧を「検索先」として保存し、ワンクリックで検索に適用します。

- Google、Bing、DuckDuckGo、Brave の検索結果ページに検索先ボタンが表示されます。ボタンを選ぶとそのサイトだけを検索します。Ctrl または Shift を押しながら選ぶか、「複数の検索先を選ぶ」をオンにすると、複数を組み合わせられます。
- 掲示板、ブログ、論文、公式ドキュメント、公的機関、レビューなど、日本、韓国、海外のサイトをまとめた検索先を 42 件用意しています。
- ウェブ全体の検索では、Pinterest やニュースサイトなどを除外できます。
- 複数のサイトをまとめて検索して大きなサイトの結果が多くなるときは、サイトごとに検索できます。
- 好きなドメインや URL のパスから自分の検索先を作り、リンクで共有できます。
- アドレスバーに `sp` と入力してスペースを押すと、選んだ検索先で検索します。
- 検索期間や Google のフォーラムタブの設定はそのまま維持されます。
- 表示言語は日本語、英語、韓国語に対応しています。

アカウント登録、サーバー、トラッキングはありません。設定はブラウザ内にだけ保存され、検索語は選んだ検索エンジンにだけ送信されます。無料のオープンソース (MIT) です。https://github.com/dooly6276/sourcepick

## Single purpose

English: Sourcepick has one purpose: to limit a web search to the sites the user chooses. It adds a bar of source buttons to the search results pages of Google, Bing, DuckDuckGo and Brave Search, and each button rewrites the search query with `site:` operators.

한국어: Sourcepick의 단일 목적은 사용자가 선택한 사이트로 웹 검색 결과를 제한하는 것입니다. 구글, Bing, DuckDuckGo, Brave 검색 결과 화면에 출처 버튼을 표시하고, 버튼을 선택하면 검색어에 `site:` 연산자를 적용해 다시 검색합니다.

日本語: Sourcepick の単一の目的は、ユーザーが選んだサイトにウェブ検索の結果を絞り込むことです。Google、Bing、DuckDuckGo、Brave の検索結果ページに検索先ボタンを表示し、ボタンを選ぶと検索語に `site:` 演算子を付けて再検索します。

## Permission justifications

| Permission | English justification |
|---|---|
| `storage` | Saves the user's settings in the browser: selected sources, own sources, preferred search engine and time filter. Nothing is sent anywhere. |
| Host access to search results pages (content scripts on `www.google.*/search*`, `www.bing.com/search*`, `duckduckgo.com/*`, `search.brave.com/search*`) | Needed to show the source buttons on these results pages and to read the current query from the page address, so the buttons show which sources are applied and a click can search again with them. The extension does not read page content other than the search query and the address parameters. |
| `omnibox` keyword `sp` | Lets the user type "sp" and a space in the address bar to search with the selected sources. It is a manifest feature, not a permission prompt. |

한국어:

| 권한 | 사용 이유 |
|---|---|
| `storage` | 선택한 출처, 내 출처, 검색엔진, 검색 기간 같은 설정을 브라우저에 저장합니다. 외부로 전송하지 않습니다. |
| 검색 결과 화면 접근(`www.google.*/search*`, `www.bing.com/search*`, `duckduckgo.com/*`, `search.brave.com/search*`의 콘텐츠 스크립트) | 해당 검색 결과 화면에 출처 버튼을 표시하고, 주소에서 현재 검색어를 읽어 적용된 출처를 표시하며, 버튼을 선택하면 해당 출처로 다시 검색하기 위해 필요합니다. 검색어와 주소 매개변수 외의 화면 내용은 읽지 않습니다. |
| 주소창 키워드 `sp` | 주소창에 `sp`와 스페이스바를 입력하면 선택한 출처로 검색합니다. 매니페스트 기능이며 별도 권한 요청이 없습니다. |

## Dashboard answers

- Remote code: No. All code is in the package; there is no `eval` and no remotely hosted script.
- Data usage: no category collected (personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity, website content: all unchecked). Certify the three limited-use statements.
- Single-purpose and privacy policy: see this file and `store/privacy.md`.
- Screenshots (1280x800): results page with the bar on Google; the popup; Manage sources; the web app on a phone is optional. The demo files are `docs/demo-en.gif` and `docs/demo-ko.gif`.
- Support URL: https://github.com/dooly6276/sourcepick/issues. Homepage: https://sourcepick.toolnjoy.com/

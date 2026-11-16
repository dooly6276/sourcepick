// 출처 묶음과 구글 검색어 만들기. 웹 앱과 크롬 확장이 같이 쓴다.
// 이 파일이 원본이다. 고친 뒤 scripts/sync-core.sh 로 web/, extension/ 에 복사한다.
(function (root) {
  "use strict";

  const GROUPS = [
    {
      id: "community",
      name: "커뮤니티",
      sites: [
        ["dcinside.com", "디시인사이드"],
        ["fmkorea.com", "에펨코리아"],
        ["theqoo.net", "더쿠"],
        ["pann.nate.com", "네이트판"],
        ["instiz.net", "인스티즈"],
        ["clien.net", "클리앙"],
        ["ruliweb.com", "루리웹"],
        ["ppomppu.co.kr", "뽐뿌"],
        ["mlbpark.donga.com", "엠엘비파크"],
        ["dogdrip.net", "개드립"],
        ["arca.live", "아카라이브"],
        ["damoang.net", "다모앙"],
        ["todayhumor.co.kr", "오늘의유머"],
        ["82cook.com", "82쿡"],
        ["bobaedream.co.kr", "보배드림"],
      ],
    },
    {
      id: "work",
      name: "직장인",
      sites: [
        ["teamblind.com", "블라인드"],
        ["community.rememberapp.co.kr", "리멤버 커뮤니티"],
        ["jobplanet.co.kr", "잡플래닛"],
      ],
    },
    {
      id: "cafe",
      name: "카페",
      sites: [
        ["cafe.naver.com", "네이버 카페"],
        ["cafe.daum.net", "다음 카페"],
      ],
    },
    {
      id: "blog",
      name: "블로그",
      sites: [
        ["blog.naver.com", "네이버 블로그"],
        ["tistory.com", "티스토리"],
        ["brunch.co.kr", "브런치스토리"],
      ],
    },
    {
      id: "qna",
      name: "지식iN",
      sites: [["kin.naver.com", "네이버 지식iN"]],
    },
    {
      id: "sns",
      name: "SNS",
      sites: [
        ["x.com", "X"],
        ["threads.com", "스레드"],
        ["instagram.com", "인스타그램"],
      ],
    },
    {
      id: "video",
      name: "동영상",
      sites: [
        ["youtube.com", "유튜브"],
        ["tiktok.com", "틱톡"],
      ],
    },
    {
      id: "global",
      name: "영어권",
      sites: [
        ["reddit.com", "Reddit"],
        ["quora.com", "Quora"],
        ["news.ycombinator.com", "Hacker News"],
        ["stackexchange.com", "Stack Exchange"],
      ],
    },
    {
      id: "dev",
      name: "개발",
      sites: [
        ["stackoverflow.com", "Stack Overflow"],
        ["github.com", "GitHub"],
        ["velog.io", "velog"],
        ["okky.kr", "OKKY"],
      ],
    },
    {
      id: "paper",
      name: "논문",
      sites: [
        ["dbpia.co.kr", "DBpia"],
        ["riss.kr", "RISS"],
        ["kci.go.kr", "KCI"],
        ["arxiv.org", "arXiv"],
      ],
    },
    {
      id: "gov",
      name: "공공기관",
      sites: [
        ["go.kr", "정부 및 공공기관(go.kr)"],
        ["re.kr", "연구기관(re.kr)"],
      ],
    },
  ];

  // 언론사 기사 제외에 쓰는 도메인. 커뮤니티가 같은 회사 도메인 밑에 있으면(mlbpark.donga.com)
  // 그 커뮤니티가 같이 빠지지 않게 기사 쪽 하위 도메인을 적는다.
  const NEWS_SITES = [
    "news.naver.com", "v.daum.net", "news.nate.com", "yna.co.kr", "chosun.com",
    "joongang.co.kr", "www.donga.com", "hani.co.kr", "khan.co.kr", "mk.co.kr",
    "hankyung.com", "sedaily.com", "mt.co.kr", "edaily.co.kr", "newsis.com",
    "news1.kr", "ytn.co.kr", "news.sbs.co.kr", "imnews.imbc.com", "news.kbs.co.kr",
    "news.jtbc.co.kr", "nocutnews.co.kr", "ohmynews.com", "asiae.co.kr",
    "heraldcorp.com", "fnnews.com", "inews24.com", "zdnet.co.kr", "etnews.com",
    "wikitree.co.kr", "insight.co.kr", "dispatch.co.kr", "seoul.co.kr", "kmib.co.kr",
  ];

  const PERIODS = [
    ["", "전체 기간"],
    ["d", "1일"],
    ["w", "1주"],
    ["m", "1개월"],
    ["y", "1년"],
  ];

  // 주소창에 붙여 넣은 주소나 www 가 붙은 이름을 도메인만 남긴다. 아니면 null.
  function normalizeDomain(input) {
    if (!input) return null;
    let s = String(input).trim().toLowerCase();
    s = s.replace(/^[a-z]+:\/\//, "").replace(/^site:/, "");
    s = s.split(/[/?#\s]/)[0].replace(/^www\./, "").replace(/\.$/, "");
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(s) && !/^([a-z0-9-]+\.)*xn--[a-z0-9-]+$/.test(s)) return null;
    return s;
  }

  function siteName(domain, customGroups) {
    for (const g of GROUPS.concat(customGroups || [])) {
      for (const [d, n] of g.sites) if (d === domain) return n;
    }
    return domain;
  }

  // 검색어에서 이 도구가 붙이는 조건(site:, -site:, 그 사이 OR)을 뺀다. 확장에서 다시 걸 때 쓴다.
  function stripFilters(q) {
    const tokens = String(q || "").trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (/^-?site:\S+$/i.test(t)) continue;
      if (/^(OR|\|)$/.test(t)) {
        const prev = out.length ? out[out.length - 1] : null;
        const next = tokens[i + 1];
        const nearSite = (next && /^-?site:/i.test(next)) || (i > 0 && /^-?site:/i.test(tokens[i - 1]));
        if (nearSite || !prev) continue;
      }
      out.push(t);
    }
    return out.join(" ");
  }

  // 검색어 안의 site: 조건만 뽑는다(확장이 지금 걸린 묶음을 알아낼 때).
  function extractSites(q) {
    const sites = [];
    let excludeNews = false;
    for (const t of String(q || "").split(/\s+/)) {
      const m = t.match(/^(-?)site:(\S+)$/i);
      if (!m) continue;
      if (m[1]) excludeNews = true;
      else sites.push(m[2].toLowerCase());
    }
    return { sites, excludeNews };
  }

  function buildQuery(text, sites, opts) {
    const o = opts || {};
    const base = stripFilters(text);
    const parts = [];
    if (base) parts.push(base);
    const uniq = Array.from(new Set(sites || []));
    if (uniq.length) parts.push(uniq.map((s) => "site:" + s).join(" OR "));
    if (o.excludeNews) {
      const keep = new Set(uniq);
      parts.push(NEWS_SITES.filter((s) => !keep.has(s)).map((s) => "-site:" + s).join(" "));
    }
    return parts.join(" ");
  }

  function googleUrl(text, sites, opts) {
    const o = opts || {};
    const params = new URLSearchParams();
    params.set("q", buildQuery(text, sites, o));
    if (o.period) params.set("tbs", "qdr:" + o.period);
    if (o.forums) params.set("udm", "18");
    return "https://www.google.com/search?" + params.toString();
  }

  root.SourceCore = {
    GROUPS, NEWS_SITES, PERIODS,
    normalizeDomain, siteName, stripFilters, extractSites, buildQuery, googleUrl,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

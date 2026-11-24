import test from "node:test";
import assert from "node:assert/strict";
import { loadLenses } from "../scripts/lenses.ts";
import "../.build/core.js";
import "../.build/store.js";

const core = globalThis.SourceCore;

test("lens files are valid", () => {
  const lenses = loadLenses();
  assert.ok(lenses.length > 20);
  for (const l of lenses) assert.ok(l.sites.length > 0, l.id);
});

test("normalizeDomain", () => {
  assert.equal(core.normalizeDomain("https://www.Reddit.com/r/foo?x=1"), "reddit.com/r/foo");
  assert.equal(core.normalizeDomain("site:go.kr"), "go.kr");
  assert.equal(core.normalizeDomain("gov"), "gov");
  assert.equal(core.normalizeDomain("theqoo.net/"), "theqoo.net");
  assert.equal(core.normalizeDomain("not a domain"), "not");
  assert.equal(core.normalizeDomain("abc!"), null);
  assert.equal(core.normalizeDomain("123"), null);
  assert.equal(core.normalizeDomain(""), null);
});

test("buildQuery joins includes with OR and adds excludes", () => {
  assert.equal(core.buildQuery("phone review", ["a.com", "b.com"], ["c.com"]), "phone review site:a.com OR site:b.com -site:c.com");
  assert.equal(core.buildQuery("x", [], []), "x");
  assert.equal(core.buildQuery("x", ["a.com"], ["a.com"]), "x site:a.com");
});

test("stripFilters removes only our filters", () => {
  assert.equal(core.stripFilters("phone site:a.com OR site:b.com -site:c.com review"), "phone review");
  assert.equal(core.stripFilters("apple OR pear"), "apple OR pear");
  assert.equal(core.stripFilters("site:a.com"), "");
});

test("buildQuery replaces existing filters instead of stacking", () => {
  const q1 = core.buildQuery("phone", ["a.com"], []);
  assert.equal(core.buildQuery(q1, ["b.com"], []), "phone site:b.com");
});

test("searchUrl per engine", () => {
  const g = new URL(core.searchUrl("x", ["a.com"], [], { engine: "google", period: "w", forums: true }));
  assert.equal(g.hostname, "www.google.com");
  assert.equal(g.searchParams.get("tbs"), "qdr:w");
  assert.equal(g.searchParams.get("udm"), "18");
  const d = new URL(core.searchUrl("x", ["a.com"], [], { engine: "duckduckgo", period: "m" }));
  assert.equal(d.hostname, "duckduckgo.com");
  assert.equal(d.searchParams.get("df"), "m");
  const b = new URL(core.searchUrl("x", [], [], { engine: "brave", period: "y" }));
  assert.equal(b.searchParams.get("tf"), "py");
  const w = new URL(core.searchUrl("x", ["a.com"], [], { engine: "bing", period: "w" }));
  assert.equal(w.hostname, "www.bing.com");
  assert.equal(w.searchParams.get("filters"), 'ex1:"ez2"');
  const now = Date.UTC(2026, 10, 24);
  const y = new URL(core.searchUrl("x", [], [], { engine: "bing", period: "y", now }));
  const day = Math.floor(now / 86400000);
  assert.equal(y.searchParams.get("filters"), 'ex1:"ez5_' + (day - 365) + "_" + day + '"');
  assert.equal(core.periodKey("bing", 'ex1:"ez3"'), "m");
  assert.equal(core.periodKey("bing", core.searchUrl("x", [], [], { engine: "bing", period: "y" }).match(/filters=([^&]+)/) && new URL(core.searchUrl("x", [], [], { engine: "bing", period: "y" })).searchParams.get("filters")), "y");
  assert.equal(core.periodKey("google", "qdr:w"), "w");
  assert.equal(core.periodKey("google", ""), "");
  const keep = new URLSearchParams("q=old&tbs=qdr:d&hl=ko&start=10");
  const k = new URL(core.searchUrl("old", ["a.com"], [], { engine: "google", keepFrom: keep }));
  assert.equal(k.searchParams.get("tbs"), "qdr:d");
  assert.equal(k.searchParams.get("hl"), "ko");
  assert.equal(k.searchParams.get("start"), null);
});

test("activeLensIds and collect", () => {
  const lenses: LensRef[] = [
    { id: "a", mode: "include", sites: [{ domain: "a.com" }, { domain: "b.com" }] },
    { id: "n", mode: "exclude", sites: [{ domain: "news.com" }] },
  ];
  const q = "x site:a.com OR site:b.com -site:news.com";
  assert.deepEqual(core.activeLensIds(q, lenses), ["a", "n"]);
  assert.deepEqual(core.activeLensIds("x site:a.com", lenses), []);
  assert.deepEqual(core.collect(lenses, ["a", "n"], ["b.com"], ["c.com"]), { include: ["a.com", "c.com"], exclude: ["news.com"] });
});

test("share links round-trip, including Korean names", () => {
  const code = core.encodeLens({ name: "내 커뮤니티", mode: "exclude", sites: [{ domain: "a.com" }, { domain: "b.co.kr" }] });
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = core.decodeLens(code);
  assert.ok(back);
  assert.equal(back.name, "내 커뮤니티");
  assert.equal(back.mode, "exclude");
  assert.deepEqual(back.sites.map((s) => s.domain), ["a.com", "b.co.kr"]);
  assert.equal(core.decodeLens("garbage!!"), null);
});

test("fit keeps queries inside each engine's word limit", () => {
  const many = Array.from({ length: 40 }, (_, i) => `s${i}.com`);
  const g = core.fit("갤럭시 S26 발열", many, [], "google");
  assert.equal(g.include.length, 29);
  assert.equal(g.cut.include.length, 11);
  assert.equal(core.fit("a b", many, [], "duckduckgo").include.length, 20);
  // Excluded sites outside the chosen sites change nothing, so they are dropped first.
  const n = core.fit("x", ["naver.com", "clien.net"], ["news.naver.com", "cnn.com", "m.clien.net/service"], "google");
  assert.deepEqual(n.exclude, ["news.naver.com", "m.clien.net/service"]);
  // Whole-web search with too many exclusions: the first ones are kept.
  const e = core.fit("x y", [], many, "google");
  assert.equal(e.exclude.length, 30);
  assert.equal(e.cut.exclude.length, 10);
  // searchUrl applies the same limit.
  const q = new URL(core.searchUrl("x", many, [], { engine: "google" })).searchParams.get("q") as string;
  assert.equal(core.parseFilters(q).include.length, 31);
  assert.equal(core.countWords(q), 1);
});

test("fit keeps queries inside each engine's length limit", () => {
  const long = Array.from({ length: 19 }, (_, i) => `community-site-number-${i}.example.com`);
  const b = core.fit("battery", long, [], "brave");
  const bq = core.buildQuery("battery", b.include, b.exclude);
  assert.ok(bq.length <= 395 && b.include.length >= 1 && b.cut.include.length > 0);
  // DuckDuckGo counts UTF-8 bytes, so Korean words take three each.
  const d = core.fit("갤럭시배터리발열후기정리 갤럭시배터리발열후기정리", long, [], "duckduckgo");
  const dq = core.buildQuery("갤럭시배터리발열후기정리 갤럭시배터리발열후기정리", d.include, d.exclude);
  assert.ok(new TextEncoder().encode(dq).length <= 490);
  // Short domains stay under the length limit, so only the word limit applies.
  assert.equal(core.fit("x", Array.from({ length: 30 }, (_, i) => `s${i}.com`), [], "brave").include.length, 19);
  const q = new URL(core.searchUrl("battery", long, [], { engine: "brave" })).searchParams.get("q") as string;
  assert.equal(core.lensState(q, { mode: "include", sites: long.map((domain) => ({ domain })) }, "brave"), "part");
});

test("lensState reports sources cut short by the limit", () => {
  const big: LensRef = { id: "big", mode: "include", sites: Array.from({ length: 40 }, (_, i) => ({ domain: `s${i}.com` })) };
  const q = new URL(core.searchUrl("x", core.lensDomains(big), [], { engine: "google" })).searchParams.get("q") as string;
  assert.equal(core.lensState(q, big, "google"), "part");
  assert.equal(core.lensState("x site:s1.com", big, "google"), "none");
  const small: LensRef = { id: "sm", mode: "include", sites: [{ domain: "a.com" }, { domain: "b.com" }] };
  assert.equal(core.lensState("x site:a.com OR site:b.com", small, "google"), "all");
});

test("normalizeDomain edge cases", () => {
  assert.equal(core.normalizeDomain("-a.com"), null);
  assert.equal(core.normalizeDomain("a-.com"), null);
  assert.equal(core.normalizeDomain("a..com"), null);
  assert.equal(core.normalizeDomain("xn--bj0bj06e.kr"), "xn--bj0bj06e.kr");
  assert.equal(core.normalizeDomain("a.com:8080"), null);
  assert.equal(core.normalizeDomain("a.com."), "a.com");
  assert.equal(core.normalizeDomain("  SITE:WWW.A.com/Path/  "), "a.com/Path");
  assert.equal(core.normalizeDomain("-site:a.com"), "a.com");
  assert.equal(core.normalizeDomain("a.com//x"), "a.com");
  assert.equal(core.normalizeDomain("a.com/x y"), "a.com/x");
  assert.equal(core.normalizeDomain("1.2.3.4"), null);
  assert.equal(core.normalizeDomain(null), null);
  assert.equal(core.normalizeDomain(undefined), null);
  assert.equal(core.normalizeDomain("a".repeat(250) + ".com"), null);
});

test("stripFilters handles groups, ORs and case", () => {
  assert.equal(core.stripFilters("foo (site:a.com OR site:b.com)"), "foo");
  assert.equal(core.stripFilters("(foo site:a.com)"), "foo");
  assert.equal(core.stripFilters("(foo OR bar) site:a.com"), "(foo OR bar)");
  assert.equal(core.stripFilters("apple OR site:a.com OR pear"), "apple OR pear");
  assert.equal(core.stripFilters("Site:A.com OR SITE:b.com 갤럭시 -Site:c.com"), "갤럭시");
  assert.equal(core.stripFilters("x site:a.com/some/path"), "x");
  assert.equal(core.stripFilters("x | site:a.com | site:b.com"), "x");
  assert.equal(core.stripFilters('"site:a.com" x'), '"site:a.com" x');
  assert.equal(core.stripFilters("OR x"), "x");
  assert.equal(core.stripFilters("  \t "), "");
  assert.equal(core.stripFilters(null), "");
  assert.equal(core.stripFilters("ok :)"), "ok :)");
  // Re-applying a lens to a query that already carries a parenthesised group does not stack filters.
  assert.equal(core.buildQuery("foo (site:a.com OR site:b.com)", ["c.com"], []), "foo site:c.com");
});

test("parseFilters reads what stripFilters removes", () => {
  assert.deepEqual(core.parseFilters("x Site:A.com/Path -SITE:b.com site:www.c.com"), { include: ["a.com/Path", "c.com"], exclude: ["b.com"] });
  assert.deepEqual(core.parseFilters("(site:a.com OR site:b.com) 검색"), { include: ["a.com", "b.com"], exclude: [] });
  assert.deepEqual(core.parseFilters("site: -site: site:!!"), { include: [], exclude: [] });
  assert.deepEqual(core.parseFilters(""), { include: [], exclude: [] });
  // What buildQuery writes is read back unchanged.
  const q = core.buildQuery("한글 검색 \"exact phrase\"", ["a.com", "b.com/x"], ["c.com"]);
  assert.deepEqual(core.parseFilters(q), { include: ["a.com", "b.com/x"], exclude: ["c.com"] });
  assert.equal(core.stripFilters(q), "한글 검색 \"exact phrase\"");
});

test("buildQuery and fit edge cases", () => {
  assert.equal(core.buildQuery("", ["a.com"], []), "site:a.com");
  assert.equal(core.buildQuery("", [], ["a.com"]), "-site:a.com");
  assert.equal(core.buildQuery("x", ["a.com", "a.com"], ["b.com", "b.com"]), "x site:a.com -site:b.com");
  // A site called "constructor" is an ordinary name, not a property of the de-duplication table.
  assert.equal(core.buildQuery("x", ["constructor", "a.com"], []), "x site:constructor OR site:a.com");
  assert.deepEqual(core.fit("", [], [], "google").include, []);
  // The query text alone fills the word limit: one site is still searched.
  const f = core.fit(Array(40).fill("w").join(" "), ["a.com", "b.com"], [], "google");
  assert.deepEqual(f.include, ["a.com"]);
  assert.deepEqual(f.cut.include, ["b.com"]);
  // A site that is both included and excluded is kept as included, and an excluded site outside the includes is dropped.
  const g = core.fit("x", ["a.com"], ["a.com", "b.com", "sub.a.com"], "google");
  assert.deepEqual(g.exclude, ["sub.a.com"]);
  // Bing takes many more sites than the others; the length limit still applies.
  const many = Array.from({ length: 120 }, (_, i) => `s${i}.com`);
  const b = core.fit("x", many, [], "bing");
  assert.ok(b.include.length === 59 && b.cut.include.length === 61);
  const longer = Array.from({ length: 60 }, (_, i) => `a-rather-long-community-name-${i}.example.co.kr`);
  const bl = core.fit("x", longer, [], "bing");
  assert.ok(core.buildQuery("x", bl.include, bl.exclude).length <= 1750 && bl.byLength && bl.include.length < 60);
  // An unknown engine falls back to Google.
  assert.equal(core.fit("x", many, [], "nope").limit, 32);
});

test("searchUrl period and forums handling", () => {
  // Clearing the period removes one carried over from the current results page.
  const keep = new URLSearchParams("tbs=qdr:d&udm=18&hl=ko");
  const cleared = new URL(core.searchUrl("x", ["a.com"], [], { engine: "google", keepFrom: keep, period: "", forums: false }));
  assert.equal(cleared.searchParams.get("tbs"), null);
  assert.equal(cleared.searchParams.get("udm"), null);
  assert.equal(cleared.searchParams.get("hl"), "ko");
  // Without options, what the page had stays.
  const same = new URL(core.searchUrl("x", ["a.com"], [], { engine: "google", keepFrom: keep }));
  assert.equal(same.searchParams.get("tbs"), "qdr:d");
  assert.equal(same.searchParams.get("udm"), "18");
  // Other udm values (images, videos) are not forums and are not removed.
  const img = new URL(core.searchUrl("x", [], [], { engine: "google", keepFrom: new URLSearchParams("udm=2"), forums: false }));
  assert.equal(img.searchParams.get("udm"), "2");
  // Forums mode exists on Google only.
  assert.equal(new URL(core.searchUrl("x", [], [], { engine: "bing", forums: true })).search.includes("udm"), false);
  // Parameters other engines use are not copied across engines.
  const cross = new URL(core.searchUrl("x", [], [], { engine: "brave", keepFrom: new URLSearchParams("tbs=qdr:d&tf=pw&q=old") }));
  assert.equal(cross.searchParams.get("tbs"), null);
  assert.equal(cross.searchParams.get("tf"), "pw");
  assert.equal(cross.searchParams.get("q"), "x");
  // Korean and special characters are encoded and read back.
  const k = new URL(core.searchUrl("갤럭시 & \"발열\" 후기", ["a.com"], [], { engine: "google" }));
  assert.equal(k.searchParams.get("q"), "갤럭시 & \"발열\" 후기 site:a.com");
  // An unknown period key sets nothing.
  assert.equal(new URL(core.searchUrl("x", [], [], { engine: "google", period: "z" as Period })).searchParams.get("tbs"), null);
});

test("periodKey recognises Bing's year on later days and ignores other ranges", () => {
  const day = Math.floor(Date.now() / 86400000) - 3;
  assert.equal(core.periodKey("bing", 'ex1:"ez5_' + (day - 365) + "_" + day + '"'), "y");
  assert.equal(core.periodKey("bing", 'ex1:"ez5_' + (day - 30) + "_" + day + '"'), "");
  assert.equal(core.periodKey("bing", "x"), "");
  assert.equal(core.periodKey("nope", "qdr:w"), "");
  assert.equal(core.periodKey("brave", "pm"), "m");
  assert.equal(core.periodKey("duckduckgo", null), "");
});

test("lensState with exclude sources, paths and unknown engines", () => {
  const ex: LensRef = { id: "x", mode: "exclude", sites: [{ domain: "a.com" }, { domain: "b.com/path" }] };
  assert.equal(core.lensState("q -site:a.com -site:b.com/path", ex, "google"), "all");
  assert.equal(core.lensState("q -site:a.com", ex, "google"), "none");
  assert.equal(core.lensState("q site:a.com site:b.com/path", ex, "google"), "none");
  assert.equal(core.lensState("q -SITE:A.COM -site:b.com/path", ex, "nope"), "all");
  assert.equal(core.lensState("q site:a.com", { mode: "include", sites: [] }, "google"), "none");
  assert.deepEqual(core.activeLensIds("q", [ex]), []);
});

test("collect removes switched-off sites and duplicates", () => {
  const lenses: LensRef[] = [
    { id: "a", mode: "include", sites: [{ domain: "a.com" }, { domain: "b.com" }] },
    { id: "b", mode: "include", sites: [{ domain: "b.com" }, { domain: "c.com" }] },
  ];
  assert.deepEqual(core.collect(lenses, ["a", "b"]), { include: ["a.com", "b.com", "c.com"], exclude: [] });
  assert.deepEqual(core.collect(lenses, ["a", "b"], ["b.com"]), { include: ["a.com", "c.com"], exclude: [] });
  assert.deepEqual(core.collect(lenses, ["zzz"]), { include: [], exclude: [] });
});

test("share links: broken, hostile and long links", () => {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  assert.equal(core.decodeLens(""), null);
  assert.equal(core.decodeLens("!!!"), null);
  assert.equal(core.decodeLens("abc"), null);
  assert.equal(core.decodeLens(enc(null)), null);
  assert.equal(core.decodeLens(enc("text")), null);
  assert.equal(core.decodeLens(enc([1, 2])), null);
  assert.equal(core.decodeLens(enc({ n: "x", s: [] })), null);
  assert.equal(core.decodeLens(enc({ n: "", s: ["a.com"] })), null);
  assert.equal(core.decodeLens(enc({ n: "   ", s: ["a.com"] })), null);
  assert.equal(core.decodeLens(enc({ n: { a: 1 }, s: ["a.com"] })), null);
  assert.equal(core.decodeLens(enc({ n: "x", s: "a.com" })), null);
  assert.equal(core.decodeLens(enc({ n: "x", s: ["not a domain!", 5, null, "javascript:alert(1)"] })), null);
  const ok = core.decodeLens(enc({ n: "  ".concat("n".repeat(80)), s: ["HTTPS://WWW.A.com/x", "a.com/x", "b.com", 7], m: "?" }));
  assert.ok(ok);
  assert.equal(ok.name.length, 40);
  assert.equal(ok.mode, "include");
  assert.deepEqual(ok.sites.map((s) => s.domain), ["a.com/x", "b.com"]);
  // At most 60 sites are read from one link.
  const big = core.decodeLens(enc({ n: "big", s: Array.from({ length: 200 }, (_, i) => `s${i}.com`) }));
  assert.ok(big);
  assert.equal(big.sites.length, 60);
  // Padding, standard base64 characters and surrounding text are not accepted silently as another lens.
  const code = core.encodeLens({ name: "a", mode: "include", sites: [{ domain: "a.com" }] });
  assert.equal(core.decodeLens(code + "=")?.name, "a");
  assert.equal(core.decodeLens(code.slice(0, -4)), null);
  // Names that are localized objects use the English one; emoji and long Korean text round-trip.
  const loc = core.encodeLens({ id: "k", name: { en: "Mine", ko: "내 것" }, mode: "include", sites: [{ domain: "a.com" }] } as LensLike);
  assert.equal(core.decodeLens(loc)?.name, "Mine");
  const emoji = core.decodeLens(core.encodeLens({ name: "🔎 검색 묶음", mode: "include", sites: [{ domain: "a.com" }] }));
  assert.equal(emoji?.name, "🔎 검색 묶음");
});

test("saved state: defaults, junk values and old states", () => {
  const store = globalThis.SourceStore;
  const setLang = (language: string) => Object.defineProperty(globalThis, "navigator", { value: { language }, configurable: true });
  setLang("en-US");
  assert.equal(store.lang(), "en");
  setLang("ko-KR");
  assert.equal(store.lang(), "ko");
  setLang("ja");
  assert.equal(store.lang(), "ja");
  setLang("fr-FR");
  assert.equal(store.lang(), "en");
  for (const raw of [null, undefined, 5, "text", true]) assert.deepEqual(store.sanitize(raw), store.defaults());
  const junk = store.sanitize({
    shown: [1, null, "forums", "forums"], active: "x", off: [3], extra: [null, "a.com"], known: "no", engine: "yahoo", period: "z",
    custom: [null, { id: "c", name: "n", sites: [null, { domain: 5 }, { domain: "a.com" }] }, { id: 1, name: "n", sites: [] }],
  });
  // Junk entries go; sources added to the English defaults after the old defaults are added once.
  assert.equal(junk.shown[0], "forums");
  assert.ok(junk.shown.every((x: unknown) => typeof x === "string"));
  assert.equal(new Set(junk.shown).size, junk.shown.length);
  assert.ok(junk.shown.includes("qna") && junk.shown.includes("news"));
  assert.deepEqual(junk.active, ["forums"]);
  assert.deepEqual(junk.off, []);
  assert.deepEqual(junk.extra, ["a.com"]);
  assert.equal(junk.engine, "google");
  assert.equal(junk.period, "");
  assert.deepEqual(junk.custom, [{ id: "c", name: "n", sites: [{ domain: "a.com" }] }]);
  const bing = store.sanitize({ engine: "bing", period: "y", forums: 1, multi: "yes" });
  assert.equal(bing.engine, "bing");
  assert.equal(bing.period, "y");
  assert.equal(bing.forums, true);
  assert.equal(bing.multi, true);
  // Unknown source ids are kept as they are (a source may exist in a newer version); the app skips them.
  assert.deepEqual(store.sanitize({ shown: ["forums", "gone-source"], known: ["forums", "gone-source"] }).shown.slice(0, 2), ["forums", "gone-source"]);
});

test("saved state: sources added later appear once, removed ones stay removed", () => {
  const store = globalThis.SourceStore;
  Object.defineProperty(globalThis, "navigator", { value: { language: "ko-KR" }, configurable: true });
  const d = store.defaults();
  // A state from before `known` existed: the sources added since then appear, the user's own choices stay.
  const old = store.sanitize({ shown: ["kr-community", "kr-no-news", "video"], active: ["kr-community"] });
  assert.ok(old.shown.includes("kr-news") && old.shown.includes("kr-shop"));
  assert.ok(!old.shown.includes("video") && old.shown.includes("kr-video"), "kr-video takes the place of video");
  assert.equal(old.shown.indexOf("kr-no-news") > old.shown.indexOf("kr-shop"), true, "new sources go before the exclude ones");
  assert.ok(old.known.includes("kr-video"));
  // Sources the user removed (known but not shown) do not come back.
  const trimmed = store.sanitize({ shown: ["kr-community"], known: d.known });
  assert.deepEqual(trimmed.shown, ["kr-community"]);
  // The user had removed the old video source before the Korean one was added: its replacement does not appear.
  const noVideo = store.sanitize({ shown: ["kr-community", "kr-blog"] });
  assert.ok(!noVideo.shown.includes("video") && !noVideo.shown.includes("kr-video"));
  // Saving and loading again changes nothing.
  assert.deepEqual(store.sanitize(JSON.parse(JSON.stringify(old))), old);
  Object.defineProperty(globalThis, "navigator", { value: { language: "en-US" }, configurable: true });
});

test("sources: no site twice, no site inside another one of the same source, domains in normal form", () => {
  for (const l of loadLenses()) {
    const ds = l.sites.map((s) => s.domain);
    assert.equal(new Set(ds).size, ds.length, `${l.id} lists a site twice`);
    for (const a of ds) for (const b of ds) {
      if (a === b) continue;
      assert.ok(!(a.startsWith(b + "/") || (!b.includes("/") && a.split("/")[0].endsWith("." + b))), `${l.id}: ${a} is already covered by ${b}`);
    }
    // www. stays in exclude sources on purpose (www.donga.com leaves mlbpark.donga.com in the results).
    for (const s of l.sites) assert.equal(core.normalizeDomain(s.domain), l.mode === "exclude" ? s.domain.replace(/^www\./, "") : s.domain, `${l.id}: ${s.domain} is not in normal form`);
  }
});

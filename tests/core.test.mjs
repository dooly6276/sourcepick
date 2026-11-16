import test from "node:test";
import assert from "node:assert/strict";
import { loadLenses } from "../scripts/lenses.mjs";
import "../src/core.js";

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
  const keep = new URLSearchParams("q=old&tbs=qdr:d&hl=ko&start=10");
  const k = new URL(core.searchUrl("old", ["a.com"], [], { engine: "google", keepFrom: keep }));
  assert.equal(k.searchParams.get("tbs"), "qdr:d");
  assert.equal(k.searchParams.get("hl"), "ko");
  assert.equal(k.searchParams.get("start"), null);
});

test("activeLensIds and collect", () => {
  const lenses = [
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
  assert.equal(back.name, "내 커뮤니티");
  assert.equal(back.mode, "exclude");
  assert.deepEqual(back.sites.map((s) => s.domain), ["a.com", "b.co.kr"]);
  assert.equal(core.decodeLens("garbage!!"), null);
});

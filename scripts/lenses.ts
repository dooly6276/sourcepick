// lenses/ 폴더의 묶음 파일을 읽고 검사한다. build.ts, 시험, check-domains.ts 가 같이 쓴다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REGIONS = ["global", "kr", "jp"];

// A lens file as read from JSON: nothing is trusted until validateLens has passed it.
interface RawLens {
  id?: string;
  name?: Record<string, unknown>;
  mode?: string;
  order?: number;
  sites?: { domain?: unknown; name?: unknown }[];
  [key: string]: unknown;
}

// A lens file that passed validation, with the folder it was found in as its region.
export interface LoadedLens {
  id: string;
  region: string;
  mode: LensMode;
  order: number;
  name: LocalizedName;
  sites: Site[];
}
const DOMAIN = /^(?:[a-z0-9-]+\.)*[a-z0-9-]+(?:\/[A-Za-z0-9._~%-]+)*$/;

export function validateLens(l: RawLens | null, file: string): string[] {
  const errs: string[] = [];
  const at = (m: string) => errs.push(`${file}: ${m}`);
  if (!l || typeof l !== "object") return [`${file}: JSON 객체가 아님`];
  const base = path.basename(file, ".json");
  if (l.id !== base) at(`id "${l.id}" 가 파일 이름 "${base}" 와 다름`);
  if (!/^[a-z0-9-]+$/.test(l.id || "")) at("id 는 영문 소문자, 숫자, - 만");
  if (!l.name || typeof l.name.en !== "string" || !l.name.en.trim()) at("name.en 필요");
  for (const [k, v] of Object.entries(l.name || {})) if (typeof v !== "string" || !v.trim()) at(`name.${k} 가 비었음`);
  if (!(["include", "exclude"] as (string | undefined)[]).includes(l.mode)) at('mode 는 "include" 나 "exclude"');
  if (!Number.isInteger(l.order)) at("order 는 정수");
  if (!Array.isArray(l.sites) || !l.sites.length) at("sites 가 비었음");
  // Google ignores words past the 32nd, DuckDuckGo about the 22nd, Brave about the 18th (2026-11).
  // A source has to leave room for a few search words on Google, the default engine. On DuckDuckGo
  // and Brave the first sites are used and the screen says how many were left out (core.fit).
  // 11-24: one 25-site "communities" source beat separate topic sources in Google tests (games went
  // to Inven, graphics cards to Quasarzone, salary talk to Blind and Remember), so the cap is 25.
  const max = l.mode === "exclude" ? 16 : 25;
  if (Array.isArray(l.sites) && l.sites.length > max) at(`sites 가 ${l.sites.length}개, ${l.mode} 출처는 ${max}개까지`);
  const seen = new Set<string>();
  for (const s of l.sites || []) {
    if (!s || typeof s.domain !== "string" || !DOMAIN.test(s.domain)) { at(`잘못된 domain: ${JSON.stringify(s && s.domain)}`); continue; }
    if (s.domain !== s.domain.toLowerCase().replace(/\/.*/, "") + (s.domain.includes("/") ? s.domain.slice(s.domain.indexOf("/")) : "")) at(`domain 은 소문자로: ${s.domain}`);
    if (/^www\./.test(s.domain) && l.mode === "include") at(`www. 는 빼고 적기: ${s.domain}`);
    if (seen.has(s.domain)) at(`같은 domain 두 번: ${s.domain}`);
    seen.add(s.domain);
    if (s.name !== undefined && (typeof s.name !== "string" || !s.name.trim())) at(`name 이 비었음: ${s.domain}`);
  }
  const extra = Object.keys(l).filter((k) => !["id", "name", "mode", "order", "sites"].includes(k));
  if (extra.length) at(`모르는 키: ${extra.join(", ")}`);
  return errs;
}

export function loadLenses({ strict = true } = {}): LoadedLens[] {
  const out: LoadedLens[] = [];
  const errs: string[] = [];
  const dir = path.join(ROOT, "lenses");
  for (const region of fs.readdirSync(dir).sort()) {
    const rdir = path.join(dir, region);
    if (!fs.statSync(rdir).isDirectory()) continue;
    if (!REGIONS.includes(region)) errs.push(`lenses/${region}: 모르는 지역 폴더(${REGIONS.join(", ")} 중 하나)`);
    for (const f of fs.readdirSync(rdir).filter((x) => x.endsWith(".json")).sort()) {
      const rel = `lenses/${region}/${f}`;
      let l: RawLens;
      try { l = JSON.parse(fs.readFileSync(path.join(rdir, f), "utf8")); } catch (e) { errs.push(`${rel}: JSON 오류 ${(e as Error).message}`); continue; }
      errs.push(...validateLens(l, rel));
      out.push({ ...l, region } as unknown as LoadedLens);
    }
  }
  const ids = new Set<string>();
  for (const l of out) { if (ids.has(l.id)) errs.push(`id 중복: ${l.id}`); ids.add(l.id); }
  if (errs.length && strict) throw new Error("묶음 파일 오류\n" + errs.join("\n"));
  out.sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) || a.order - b.order || a.id.localeCompare(b.id));
  return out;
}

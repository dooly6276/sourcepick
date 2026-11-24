// 묶음에 적힌 사이트가 실제로 열리는지 본다(네트워크 필요). 끝 도메인(gov, go.kr 등)은 건너뛴다.
// 사용: node scripts/check-domains.ts [묶음 id ...]
import { loadLenses } from "./lenses.ts";

const only = process.argv.slice(2);
const lenses = loadLenses().filter((l) => !only.length || only.includes(l.id));
const domains = [...new Set(lenses.flatMap((l) => l.sites.map((s) => s.domain)))]
  .filter((d) => d.includes(".") && !/^(go|re|or|ac|co)\.[a-z]{2}$/.test(d));

async function check(d: string): Promise<string | null> {
  const url = "https://" + d.replace(/^\./, "") + (d.includes("/") ? "" : "/");
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(12000) });
      if (res.status < 500 && res.status !== 404) return null;
      if (method === "GET") return `${d}: HTTP ${res.status}`;
    } catch (e) {
      if (method === "GET") return `${d}: ${(e as { cause?: { code?: string }; name: string }).cause?.code || (e as { name: string }).name}`;
    }
  }
  return null;
}

const problems: string[] = [];
const queue = domains.slice();
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) { const p = await check(queue.shift() as string); if (p) problems.push(p); }
}));
console.log(`${domains.length}개 확인, 문제 ${problems.length}개`);
for (const p of problems.sort()) console.log("  " + p);
process.exitCode = problems.length ? 1 : 0;

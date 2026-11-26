// Builds supabase/generated/real-data.sql from the template and the research JSON files.
// Usage: pnpm data:sql
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(new URL(`../supabase/${p}`, import.meta.url), "utf8"));
const portfolio = read("data/portfolio.json");
const investors = read("data/investors.json");
const logos = read("data/portfolio-logos.json");

const missingLogo = portfolio.companies.filter((c) => !logos[c.name]).map((c) => c.name);
if (missingLogo.length) throw new Error(`Missing logos for: ${missingLogo.join(", ")}`);
for (const c of portfolio.companies) {
  for (const r of c.records) if (!r.url.startsWith("https://")) throw new Error(`Non-https record URL for ${c.name}: ${r.url}`);
  // Every round must cite one of the company's own records: no unsourced funding data.
  const urls = new Set(c.records.map((r) => r.url));
  for (const rd of c.rounds ?? []) {
    if (!urls.has(rd.source_url)) throw new Error(`Round ${rd.key} of ${c.name} cites a URL that is not one of its records`);
    if (!rd.participants?.length) throw new Error(`Round ${rd.key} of ${c.name} has no participants`);
  }
}

const p = JSON.stringify({ retrieved: portfolio.retrieved, logos, companies: portfolio.companies });
const i = JSON.stringify({ investors: investors.investors });
for (const [name, s] of [
  ["portfolio", p],
  ["investors", i],
]) {
  if (s.includes(`$${name}$`)) throw new Error(`Dollar-quote delimiter found inside ${name} JSON`);
}

const sql = readFileSync(new URL("../supabase/load-real-data.template.sql", import.meta.url), "utf8")
  .replace("__PORTFOLIO_JSON__", () => p)
  .replace("__INVESTORS_JSON__", () => i);

mkdirSync(new URL("../supabase/generated/", import.meta.url), { recursive: true });
writeFileSync(new URL("../supabase/generated/real-data.sql", import.meta.url), sql);
console.log(
  `Wrote supabase/generated/real-data.sql (${(sql.length / 1024).toFixed(1)} KB): ${portfolio.companies.length} companies, ${portfolio.companies.reduce((n, c) => n + (c.rounds?.length ?? 0), 0)} rounds, ${investors.investors.length} investors`,
);

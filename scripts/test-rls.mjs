// Runs tests/rls/isolation.sql against a Supabase project (rolled back, so it leaves no data) and
// fails if any isolation check fails. Usage: SUPABASE_PROJECT_REF=<ref> pnpm test:rls
import { execFileSync } from "node:child_process";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) {
  console.error("Set SUPABASE_PROJECT_REF to the project to test (the Supabase CLI must be logged in).");
  process.exit(2);
}

const output = execFileSync("supabase", ["db", "query", "--linked", "--project-ref", ref, "-f", "tests/rls/isolation.sql", "--output-format", "json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const { rows } = JSON.parse(output.slice(output.indexOf("{")));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("No check results returned; the test did not run.");
  process.exit(1);
}
const failed = rows.filter((r) => r.pass !== true);
for (const r of failed) console.error(`FAIL ${r.check_name}: expected ${r.expected}, got ${r.actual}`);
console.log(`${rows.length - failed.length}/${rows.length} isolation checks passed`);
process.exit(failed.length ? 1 : 0);

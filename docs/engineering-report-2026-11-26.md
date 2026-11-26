# Engineering report — 26 November 2026

## Issues found in the audit, and what was done

| Severity | Issue | Resolution |
| --- | --- | --- |
| Critical | Open redirect: `/auth/callback?next=/\evil.com` would send a signed-in user to another site. | One URL-parser-based check (`lib/safe-path.ts`) used by every redirect and notification link; tests added. |
| High | Data loader would delete meetings, notes and notifications and overwrite edited profiles if re-run. | Destructive steps moved to a one-time script scoped to demo rows; loader no longer overwrites edits. |
| High | Unsourced data: funding stages and some check sizes had been filled in without a source; several citations pointed at pages that did not name the subject. | Unsourced values cleared; inferred values labelled; citations replaced or removed and all 75 re-checked. |
| High | Failed database reads rendered as empty lists. | Page reads go through `lib/db.ts`, which throws to the error screen. |
| Medium | Failures of secondary writes (notifications, audit entries, cleanup) were ignored. | Logged without personal data; primary status updates now return errors. |
| Medium | A generic RPC let staff code send free-text notifications. | Replaced by fixed notification kinds, translated per reader; old function dropped. |
| Medium | About 45 manual casts on joined query results; non-null assertions on environment values. | Removed in favour of generated types, type guards and validated `env.ts`. |
| Low | Four unused dependencies; no formatter. | Removed; Prettier added with `format:check`. |

## Type safety

- `strict` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- No `any`, `@ts-ignore`, `eslint-disable` or non-null assertions in `src`.
- Remaining `as` uses are `as const` literals.

## Tests

- 56 unit tests: matching, uploads, money and time parsing, redirect safety, translation parity (same keys and placeholders in all three languages).
- 72 database isolation checks across investor, founder, staff, signed-out and deactivated users. The script creates fixtures in a transaction and rolls back.

## Verification actually run

| Command | Result |
| --- | --- |
| `pnpm check` (format, lint, typecheck, tests) | pass, 56/56 |
| `next build` | pass |
| `pnpm test:rls` | 72/72 |
| Supabase security advisor | expected `security definer` warnings; leaked-password protection is off |
| Browser (production build) | checked: sign-in, language switch, admin overview, startups, next rounds, matching, investor evidence, investor portfolio and records, founder overview, mobile width on next rounds; no console or server errors |

## Not verified

- The approve → share → question → answer flow and document upload were exercised in the browser before this refactor, not repeated after it. The database rules behind them are covered by the isolation tests.
- No automated browser tests or integration tests for Server Actions.
- Invitations: never sent, because `SUPABASE_SECRET_KEY` is not configured.
- Uzbek and Russian wording has not been reviewed by a native speaker.

## Remaining debt

- Stored content is English only; localized content would need per-language columns.
- Investor list and matching load all rows and filter in memory; fine at this size, add pagination in the high hundreds.
- No rate limiting beyond Supabase Auth's own.
- Portfolio logos are loaded from YV's media server, which is slow; consider copying them into Storage.

---

# Addendum: Crunchbase analysis and optimization (same day)

What was adopted and why: [`crunchbase-analysis-2026-11-26.md`](crunchbase-analysis-2026-11-26.md).

## Performance

| Measure | Before | After |
| --- | --- | --- |
| Investor reads latest 50 of 20,000 public records (`tests/perf/rls-bench.sql`, avg of 5) | 7,006 ms | 10 ms |
| Investor counts 20,000 records | 6,892 ms | 8 ms |
| Staff reads latest 50 of 20,000 records | 3,079 ms | 7 ms |
| Supabase performance advisor warnings | 18 (12 per-row auth calls, 6 duplicate policies) + 56 unindexed foreign keys | 0 warnings; only "unused index" notices for new indexes |
| Portfolio logo transfer | originals up to ~1.1 MB each | ~1.8 KB WebP/JPEG at display size, cached 31 days |

How: permission helpers in every policy are wrapped in `(select …)` so Postgres runs them once per query. The per-row "is portfolio company" check became one set lookup. `FOR ALL` write policies were split so reads evaluate one policy. Every foreign key got an index. `next/image` optimization was turned on for logos. Migration: `20261126001000_rls_performance.sql`, generated from the live policy definitions, with the same conditions as before.

## New

- `funding_rounds` and `round_participants`. Each round must cite one of the company's records (a trigger checks this). They have the same visibility as public records.
- `company_follows`, with alerts to followers on new records and rounds. Investors can follow portfolio companies only. Staff can read follows; founders cannot.
- `portfolio_directory()` now returns the round count, the disclosed total and the last reported round.
- Pages: Insights and Search (staff), and a funding card on investor and staff company pages. Staff add rounds from the company page.
- `GET /api/export/portfolio|investors`: staff only, written to the audit log, protected against CSV formula injection.

## Bug caught during verification

- The alert trigger first used variable names that clashed with column names (`title`), which would have made every new public record fail. It was caught when the data loader ran, and fixed before any use. The isolation suite now covers the alert path.

## Verification actually run

| Command | Result |
| --- | --- |
| `pnpm check` | pass, 68/68 unit tests (12 new: funding stats, participant parsing, CSV) |
| `next build` | pass |
| `pnpm test:rls` | 94/94 (22 new: rounds, participants, follows, alerts, signed-out, deactivated) |
| Browser, production build | staff: insights, search, company funding card, follow/unfollow, add-round validation, CSV exports (38 companies, 50 investors), next-rounds column. Investor: portfolio cards, follow + filter, company funding card in Russian, exports and staff pages refused. No server errors. |

## Not verified or not done

- Adding a valid round through the form was not submitted, to avoid writing test rows to the live data. The database rules and the action are covered by the isolation tests and type checks.
- An alert notification was not seen arriving in a browser. The trigger is covered by the isolation tests.
- Pagination is still in-memory (52 investors, 38 companies).

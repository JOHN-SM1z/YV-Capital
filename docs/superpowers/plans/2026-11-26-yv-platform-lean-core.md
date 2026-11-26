# YV Platform Lean Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, invite-only, three-portal platform (YV workspace, investor portal, founder portal) on Supabase with RLS, matching, opportunity sharing, diligence Q&A, meetings and KPI overview.

**Architecture:** Next.js 16 App Router renders every page on the server and reads data through the Supabase SSR client as the signed-in user, so Postgres RLS is the single source of authorization. Mutations are Server Actions that re-check the session and role server-side. Matching is a pure TS module. Files go through private Storage and a signed-URL route handler.

**Tech Stack:** Next.js 16.4, React 19, TypeScript strict, Tailwind 4, shadcn/ui, lucide-react, recharts, @supabase/ssr 0.12, @supabase/supabase-js 2.119, zod 4, Vitest 4, Supabase CLI 2.114 (local stack).

**Spec:** `docs/superpowers/specs/2026-11-26-yv-platform-lean-core-design.md`

## Global Constraints

- Brand: charcoal `#141414`, orange `#FF6F0D` (primary actions/highlights only), surface `#f4f5f7`. Headings Space Grotesk, body Plus Jakarta Sans.
- Four user types exactly: `yv_admin`, `yv_team`, `investor`, `founder`.
- RLS enabled on every table in `public`. No table readable by `anon`.
- `SUPABASE_SERVICE_ROLE_KEY` is only imported from `src/lib/supabase/admin.ts`, which has `import "server-only"`.
- Matching weights: check 30, stage 25, sector 25, geography 15, co-invest 5.
- KPI targets: qualified investors 50, priority relationships 20, substantive meetings 12, investment-ready startups 3 (range 3–5), diligence processes 2, signed partnerships 1.
- Demo investors are badged "DEMO". Real portfolio rows carry `source = 'yoshlarventures.uz (public)'`. No financial figures are imported for them.
- No screen button without a working server action.

## Review Focus

1. An investor opens `/investor/opportunities/<id>` for an opportunity not shared with their org → 404, never data. Test: RLS test `investor_b_cannot_read_opportunity_shared_with_a`.
2. A founder answer to a diligence question before YV approval → invisible to the investor. Test: `investor_cannot_read_unapproved_response`.
3. An investor with no `min_check`/`max_check` set → matching still scores them (check component neutral 0.5), never crashes. Test: `scoreMatch handles missing check range`.
4. A deactivated user with a valid session → treated as signed out (middleware / `getSessionUser` returns null). Test: RLS helper `is_active_member` false when `organization_members.is_active = false`.
5. Uploading a `.exe` renamed to `.pdf` → rejected by signature check. Test: `validateUpload rejects mismatched signature`.

---

### Task 1: Scaffold & brand

**Files:** `package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `components.json`, `src/components/ui/*` (shadcn: button, input, label, card, badge, table, dialog, select, textarea, tabs, dropdown-menu, separator, sonner), `public/yv/logo.png`, `.env.example`, `vitest.config.ts`.

- [ ] `create-next-app` (TS, Tailwind, App Router, src dir, ESLint), init shadcn, add the components above.
- [ ] Theme tokens in `globals.css`: `--primary: #FF6F0D`, `--foreground: #141414`, `--muted: #f4f5f7`. Fonts via `next/font/google`.
- [ ] Download the logo from `https://yoshlarventures.uz/yv/logo.png` and `logo-mark.png` into `public/yv/`.
- [ ] Verify: `pnpm build` passes. Commit.

### Task 2: Schema, RLS, seed

**Files:** `supabase/config.toml`, `supabase/migrations/0001_core.sql`, `0002_rls.sql`, `0003_storage.sql`, `supabase/seed.sql`, `scripts/seed-users.ts`, `tests/rls/*.test.ts`.

**Produces:** enums `user_type`, `org_type ('yv','investor','startup')`, `relationship_status` (spec's 12 values), `pipeline_stage` (spec's 16 values), `opportunity_status ('draft','internal_review','approved','shared','closed','paused','withdrawn')`, `interest_level ('interested','info_requested','indicative','declined')`, `verification_status ('founder_submitted','yv_verified','rejected')`. SQL helpers `auth_user_type() returns user_type`, `is_yv_staff()`, `is_yv_admin()`, `is_member_of(org uuid)`, `my_org_ids() returns setof uuid` — all `security definer`, `stable`, filtering `is_active`.

- [ ] Tables per spec §7. Opportunity visibility for investors: `exists (select 1 from opportunity_access a where a.opportunity_id = id and is_member_of(a.investor_org_id)) and status in ('shared','closed')`.
- [ ] `due_diligence_responses` select for investors requires `approved_for_release`. Founders see the requests addressed to their startup (`routed_to_startup = true`), never `investor_org_id` (exposed to founders through view `founder_dd_requests` that omits it).
- [ ] `notes`, `match_overrides`, `audit_logs` are staff-only.
- [ ] Seed: YV org, 38 real portfolio startups, 10 DEMO investors with preferences, 3 opportunities, KPI targets, meetings. `scripts/seed-users.ts` creates auth users via admin API: `admin@yv.demo`, `team@yv.demo`, `investor.a@demo.test`, `investor.b@demo.test`, `founder.a@demo.test`, `founder.b@demo.test`. Password comes from `DEMO_PASSWORD` in `.env.local`.
- [ ] RLS tests (Vitest, signed in as each demo user against local stack): `investor_b_cannot_read_opportunity_shared_with_a`, `investor_cannot_read_other_org_interests`, `investor_cannot_read_notes`, `founder_cannot_read_other_startup`, `founder_cannot_read_investor_identity_on_request`, `investor_cannot_read_unapproved_response`, `yv_team_cannot_approve_opportunity`, `deactivated_member_reads_nothing`.
- [ ] Verify: `supabase db reset && pnpm seed:users && pnpm test:rls` all pass. Commit.

### Task 3: Matching engine

**Files:** `src/lib/matching/score.ts`, `src/lib/matching/types.ts`, `tests/matching/score.test.ts`.

**Produces:** `scoreMatch(investor: InvestorProfileForMatch, startup: StartupProfileForMatch): MatchResult` where `MatchResult = { score: number; fit: 'strong'|'possible'|'weak'|'none'; reasons: { kind: 'pos'|'neg'|'neutral'; text: string }[] }`; `rankInvestors(startup, investors): (MatchResult & { investorId: string })[]`; `rankStartups(investor, startups)`.

- [ ] Tests: check overlap full → 30; disjoint check range → `fit: 'none'`, score 0; missing check range → 15 + neutral reason; stage match 25; sector match by case-insensitive tag; `Uzbekistan`/`Central Asia` in geographies or `ca_interest = true` → 15; inactive/rejected investor excluded from `rankInvestors`. Fit bands: ≥70 strong, ≥45 possible, >0 weak.
- [ ] Verify: `pnpm test` passes. Commit.

### Task 4: Auth, session, layouts

**Files:** `src/lib/supabase/{server,client,admin}.ts`, `src/middleware.ts` (Next 16 `proxy.ts` if required by bundled docs), `src/lib/auth.ts`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/(admin)/admin/layout.tsx`, `src/app/(investor)/investor/layout.tsx`, `src/app/(startup)/startup/layout.tsx`, `src/components/shell/*`.

**Produces:** `getSessionUser(): Promise<SessionUser | null>` with `{ id, email, fullName, userType, orgId, orgName, isOrgAdmin }`; `requireUser(types: UserType[]): Promise<SessionUser>` (redirects to `/login` or renders forbidden).

- [ ] Login by email + password and magic link; no public signup. `/` redirects by user type.
- [ ] Each layout calls `requireUser` with its allowed types. Shared shell with sidebar nav, org badge, sign-out.
- [ ] Verify: sign in as each demo user lands on the right portal; cross-portal URL shows the forbidden state. Commit.

### Task 5: YV workspace

**Files:** `src/app/(admin)/admin/{page,investors,startups,matching,opportunities,diligence,meetings,team,activity}/…`, `src/lib/actions/*.ts`, `src/lib/audit.ts`.

- [ ] Investors list (search + filters type/country/status/stage/sector) and detail with edit, preferences, notes, follow-ups.
- [ ] Startups list (stage filter) and detail with metrics (source/period/verification), stage change → `startup_status_history`.
- [ ] Matching page: choose startup or investor, ranked table with reasons, "Share" link to opportunity flow.
- [ ] Opportunities: create from startup, submit for review, admin approve, choose investor orgs (writes `opportunity_access`), audit-logged.
- [ ] Diligence queue: route to founder, approve response for release.
- [ ] Meetings + follow-ups; team invites (admin-only, uses admin client + `inviteUserByEmail`); activity log.
- [ ] Overview KPIs from SQL view `program_kpis`, potential vs committed kept separate.
- [ ] Verify each action end-to-end in browser as admin and team. Commit per section.

### Task 6: Founder portal

**Files:** `src/app/(startup)/startup/{page,profile,documents,requests,meetings}/…`, `src/lib/uploads.ts`, `src/app/api/files/[id]/route.ts`, `tests/uploads.test.ts`.

**Produces:** `validateUpload(file: { name: string; type: string; size: number; head: Uint8Array }): { ok: true } | { ok: false; error: string }`. Allowed: pdf, png, jpg, xlsx, docx, pptx, csv; max 25 MB.

- [ ] Profile edit with metric versions (new row per update). Documents upload/list. Requests answer. Readiness checklist.
- [ ] Verify: founder.a edits, uploads, answers; founder.b never sees it. Commit.

### Task 7: Investor portal

**Files:** `src/app/(investor)/investor/{page,opportunities,opportunities/[id],meetings,organization,preferences}/…`.

- [ ] Shared opportunities only; room with approved docs, Q&A (ask; see approved answers), express interest / indicative amount with non-binding notice, request meeting. Preferences edit feeds matching. Org admin invites teammates.
- [ ] Verify: investor.a sees shared opportunity; investor.b gets 404. Commit.

### Task 8: Final verification

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:rls && pnpm build`.
- [ ] README: setup, env vars, demo accounts, what is built vs later.

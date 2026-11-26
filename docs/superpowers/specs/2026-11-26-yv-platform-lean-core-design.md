# YV International Capital Platform — Lean Core (v1) Design

Date: 2026-11-26 · Status: draft for approval

## 1. Why

Yoshlar Ventures (YV) wants one private place for all of its international work: relationships with global investors, sharing portfolio deals, diligence, meetings, and matching founders with investors who fit. It must stay simple. The owner was explicit that it should **not become another complex CRM**.

The full technical spec (9 roles, 14 admin sections, ~50 tables) is the long-term target. The owner chose **Option A**: ship a lean core first, on a data model that can grow into the full spec without a rebuild.

## 2. Goals, non-goals, anti-goals

**Goals (v1)**
- YV staff manage international investors (directory + light relationship tracking) and portfolio startups.
- **Matching:** for any startup, a ranked list of investors who fit, and the reverse. Each match shows its reasons (check size, stage, sector, geography).
- YV creates an opportunity from a startup, approves it, and shares it with **specific** investor organizations only.
- Investors see only what was shared with them. They can express interest, ask questions and request meetings.
- Founders keep their profile, metrics and documents current and answer YV requests.
- Diligence Q&A: investor asks → YV routes to the founder → founder answers → YV approves → the investor sees the answer.
- Meetings with notes and follow-ups.
- Overview KPIs against the 180-day targets, computed from real data.

**Non-goals (v1, later phases)**
- Co-investment / syndication workspace, institutional partnerships pipeline, memo generator, global map, PDF exports, Gmail/Google Calendar sync, board role, per-user permission overrides, enforced MFA.

**Anti-goals (a failure even if it "works")**
- Any investor seeing another investor's data, interest or identity.
- A founder auto-published to investors, or seeing investor scores or notes.
- Any metric that isn't from the database, or potential interest shown as committed capital.
- Screens or buttons without a working backend.
- A cluttered, CRM-like UI.

## 3. Approach

**Chosen:** Next.js (App Router, TypeScript strict) + Tailwind + shadcn/ui, on Supabase (Postgres, Auth, Storage, Row-Level Security). This is the stack the spec prescribes, and the repo is empty, so nothing conflicts with it.

Alternatives dropped: a separate API server (more moving parts, and RLS already enforces access in the database), and a no-code CRM base (it can't give investors and founders isolated portals).

**Environments:** local Supabase via the CLI for development (needs Docker running). Hosted Supabase + Vercel once the owner connects accounts.

## 4. Users (4 types)

| Type | Who | Sees |
|---|---|---|
| `yv_admin` | YV leadership / program director | Everything; approves sharing; manages users |
| `yv_team` | Investment, IR, analysts | All investors and startups; edits records; cannot approve sharing or manage users |
| `investor` | Member of one investor org (`is_org_admin` flag) | Only their org's shared opportunities, their own interests, Q&A and meetings |
| `founder` | Member of one startup org | Only their own startup, requests sent to them, meetings shared with them |

Roles live in database tables, so the spec's finer roles (legal, board, analyst) can be added later without a schema change.

## 5. Screens

**YV workspace (`/admin`)**
1. **Overview:** 180-day KPI targets vs actuals, pipeline counts, overdue follow-ups, recent activity.
2. **Investors:** searchable list (type, country, sector, stage, check size, status, owner). Profile with preferences, contacts, notes, meetings and shared opportunities.
3. **Startups:** portfolio + pipeline stage. Profile separates founder-submitted, YV-verified, and internal-only data. Every metric carries its source, period and verification status.
4. **Matching:** pick a startup → ranked investors with reasons, or pick an investor → ranked startups. "Share opportunity" acts on a result.
5. **Opportunities:** Draft → Internal review → Approved → Shared, with a per-org access list. Admin-only approval.
6. **Diligence & Q&A:** queue of investor questions, routing to founders, approval before release.
7. **Meetings:** list/calendar, notes, outcomes, follow-ups with due dates.
8. **Team & access:** invite users, assign type and org, deactivate.
9. **Activity log:** audit trail of sensitive actions.

**Investor portal (`/investor`):** Overview · Opportunities (shared only) · Opportunity room (summary, approved docs, Q&A, express interest / non-binding indication, request meeting) · Meetings · Organization & team · Investment preferences (these feed matching).

**Founder portal (`/startup`):** Overview (readiness checklist, open requests) · Company profile (versioned metrics and fundraising) · Documents · Requests from YV · Meetings.

## 6. Matching

- Computed on the server for YV users only. Investors and founders never see scores.
- **Hard filters:** an investor marked inactive or rejected is excluded, and so is any investor whose check range doesn't overlap the round at all (shown as an explicit "no fit" reason when browsing).
- **Weighted score (0–100):** check-size fit 30, stage 25, sector 25, geography / Central Asia interest 15, co-investment appetite 5. Weights live in one config, so they're easy to tune.
- Each result lists plain reasons, e.g. "Ticket $50K–250K covers $150K round" or "Sector: EdTech not in focus".
- Matching only suggests. Sharing always goes through the approval flow.
- A pure TypeScript function with unit tests.

## 7. Data model (v1 subset of the spec's tables)

`organizations` (type: yv / investor / startup), `user_profiles`, `organization_members`, `roles`. Investors: `investors`, `investor_contacts`, `investor_preferences`. Startups: `startups`, `startup_founders`, `startup_metrics` (source, period, verification), `startup_fundraising` (versioned), `startup_documents`, `startup_readiness_tasks`, `startup_status_history`. Deals: `investment_opportunities`, `opportunity_access`, `opportunity_documents`, `opportunity_status_history`, `investor_interests`. Diligence: `due_diligence_requests`, `due_diligence_responses` (with `approved_for_release`). Activity: `meetings`, `meeting_participants`, `follow_ups`, `notes` (internal-only), `notifications`, `audit_logs`, `document_access_logs`, `program_kpi_targets`.

UUID keys, `created_at/updated_at/created_by/updated_by`, and soft delete on business records. Files live in Storage, never in Postgres.

## 8. Security

- RLS on every table, using helpers `is_yv_staff()`, `is_yv_admin()` and `is_member_of(org_id)`.
- An investor reads an opportunity only if an `opportunity_access` row exists for their org. An investor reads only their own org's interests and Q&A, and a diligence answer only when `approved_for_release`.
- Founders read only rows tied to their startup org. Internal notes and match scores are staff-only tables.
- Private Storage buckets. Downloads go through a server route that checks access and returns a short-lived signed URL, then logs the access. File type, size and signature are checked on upload.
- Invite-only signup. Privileged actions run server-side and never trust a client-supplied role or org id. Service-role key is server-only.
- **Automated cross-org tests:** seeded users of each type (two investor orgs, two startups) try to read each other's data through the database API and must fail.

## 9. Data & branding

- **Real YV brand** (from yoshlarventures.uz): charcoal `#141414`, orange `#FF6F0D` (primary actions and highlights only), light surface `#f4f5f7`, Space Grotesk for headings and Plus Jakarta Sans for body. YV logo from the public site. Restrained and institutional: orange as the accent, mostly neutral surfaces.
- **Real portfolio:** the 38 companies listed publicly on yoshlarventures.uz are seeded with name, sector and one-line description, each tagged "Source: yoshlarventures.uz (public)". The unlabeled dollar figures on the site are **not** imported as metrics. Founders or YV fill in verified numbers.
- **Investors:** 10 fictional investor orgs, clearly badged "DEMO". No real investor relationships are implied.
- **Demo accounts:** one per user type (plus a second investor org and second startup for isolation tests). Real staff names are not used for demo logins.

## 10. Builder's calls (not decided by the owner)

- UI language: English first (international investors), with text kept in one place so Uzbek/Russian can be added.
- 180-day targets are seeded from the spec (50 / 20 / 12 / 3–5 / 2 / 1) and editable by admins.
- Notifications: in-app only in v1.
- Testing: Vitest for matching and server logic; RLS tests run against the local Supabase.
- Build order: foundation (auth, orgs, roles, schema, RLS, layouts) → YV workspace → matching → founder portal → investor portal and opportunities → Q&A → meetings → overview KPIs → security test pass.

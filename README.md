# YV Capital Partnerships Platform

A private platform where Yoshlar Ventures (YV) runs its international capital partnerships, and where investors and founders work with YV in separate portals. Available in **Uzbek, Russian and English**.

- **YV workspace (`/admin`):** a personal desk for each staff member, 180-day targets, the portfolio with public records and sourced funding rounds, next-round outlook, insights (co-investors, funding by month and sector, investor attention), search, CSV export, investors with their Uzbekistan evidence, matching, opportunities (approve, then share with chosen investors), diligence Q&A, meetings and follow-ups, team access, activity log.
- **Investor portal (`/investor`):** opportunities shared with that organization, the YV portfolio with every public record and funding round per company, follow a company to get alerts on new records and rounds, questions, non-binding interest, meeting requests, preferences and team.
- **Founder portal (`/startup`):** company profile, versioned metrics and fundraising, documents, requests from YV, readiness checklist, public records about the company, meetings.

Design: [`docs/superpowers/specs/2026-11-26-yv-platform-lean-core-design.md`](docs/superpowers/specs/2026-11-26-yv-platform-lean-core-design.md) · Engineering report: [`docs/engineering-report-2026-11-26.md`](docs/engineering-report-2026-11-26.md) · What we took from Crunchbase: [`docs/crunchbase-analysis-2026-11-26.md`](docs/crunchbase-analysis-2026-11-26.md)

## Sign-in and sign-up

Email and password, email sign-in links, Google, Apple and Microsoft. Anyone can sign up, but a new account sees nothing until a YV admin approves it under **Team & access → Access requests**, or until its verified email matches a pre-approval. Provider and email setup: [`docs/auth-setup.md`](docs/auth-setup.md).

## Stack

- Next.js 16 (App Router, strict TypeScript), Tailwind 4, Recharts, zod.
- Supabase: Postgres with Row-Level Security (RLS), Auth, private Storage.
- Server Components read data as the signed-in user, so **RLS is the source of authorization**. Server Actions re-check the session and validate input.

## Commands

```bash
pnpm install
pnpm dev                 # http://localhost:3000
pnpm check               # format, lint, strict typecheck, unit tests
pnpm build && pnpm start
SUPABASE_PROJECT_REF=<ref> pnpm test:rls   # database isolation tests (rolled back; needs `supabase login`)
pnpm data:sql            # rebuild supabase/generated/real-data.sql from supabase/data/*.json
supabase db query --linked --project-ref <ref> -f tests/perf/rls-bench.sql   # RLS timing with 20,000 rolled-back rows
```

Environment (`.env.local`, never committed; template in `.env.example`):

| Variable                               | Purpose                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (browser-safe) key                                                             |
| `SUPABASE_SECRET_KEY`                  | **Server only.** Needed to send invitations. Without it, invite forms say "not connected". |
| `NEXT_PUBLIC_SITE_URL`                 | Public URL used in invitation and sign-in emails. Set it in production.                    |
| `DEMO_PASSWORD`                        | Password of the test logins                                                                |

## Setting up a new database

1. Apply `supabase/migrations/*.sql` in filename order.
2. `supabase/seed.sql` (organizations, portfolio names, KPI targets, demo records).
3. `supabase/seed-users.template.sql` with the password placeholder replaced (never commit the value).
4. `supabase/remove-demo-data.sql` (removes the fictional records, keeps two sandbox investors, links the founder test logins).
5. `pnpm data:sql`, then run `supabase/generated/real-data.sql`. Safe to re-run: it does not delete user-created rows or overwrite edited profiles, preferences or staff outlooks.

## Test logins

All use `DEMO_PASSWORD`. **Remove them before real users join.**

| Login                                          | Portal                                            |
| ---------------------------------------------- | ------------------------------------------------- |
| `admin@yv.demo`                                | YV Admin: everything, approves and shares         |
| `team@yv.demo`                                 | YV Team: no approvals, sharing, team or audit log |
| `investor.a@demo.test`, `investor.b@demo.test` | Sandbox investor organizations (marked SANDBOX)   |
| `founder.a@demo.test`                          | Makon AI (real portfolio company, test login)     |
| `founder.b@demo.test`                          | TimePay (real portfolio company, test login)      |

Every real investor and portfolio company already has its own organization. Its dashboard becomes usable when YV invites a person into it.

## The data, and how far to trust it

Sources are in `supabase/data/`, compiled 26 November 2026.

- **Portfolio (38):** names, sectors, one-liners and logos from yoshlarventures.uz. The dollar figure on each card is printed **without a label**; it matches reported YV investments where press coverage exists. Confirm it internally.
- **Public records (63):** each has a source link. Most companies have only the YV listing; press coverage exists for a minority.
- **Funding rounds (19, 16 companies, $2.16M disclosed):** structured only from those records; each round cites its record (enforced by the database). The date is when the source reported it; round type and lead investor are set only where a source says so.
- **Investors (50):** each has a cited page about an Uzbek investment, partnership or stated interest. Links were machine-checked to load and name the investor; the exact claims were not individually re-read. **Sectors, stages and Central Asia interest are inferred** from those sources. Check sizes are mostly unknown, so matching treats them as neutral.
- **Next-round outlook (38):** an estimate from public signals, staff-only. 21 companies have too little data.
- **Stored research text** (record summaries, investor evidence, outlook rationale) is in English; the interface around it is translated.
- Uzbek and Russian interface text was machine-written and should be proofread by a native speaker.

## Security model

- An investor sees an opportunity only if it was shared with their organization. Investors never see other investors, their interest or their questions.
- Founders never read investor tables. Investor questions reach them as YV-written requests with no investor identity.
- Answers reach an investor only after YV releases them. A document attached to an answer joins the opportunity's data room, so every investor with access to that opportunity can open it.
- Public records and funding rounds of portfolio companies are readable by every signed-in member. Those of other companies, and all outlooks, are staff-only.
- Follows are private to the person following. YV staff can see them as an internal interest signal (the investor screen says so); founders and other investors never can. Investors can follow portfolio companies only.
- CSV export is staff-only, contains no internal notes or outlooks, and every export is written to the audit log.
- Documents are authorized per file; downloads are logged and use 60-second signed URLs. Uploads are re-validated on the server by file signature.
- Signing up gives no access. Accounts stay pending until an admin approves them, or until a confirmed email matches an admin's pre-approval. Sign-up metadata such as "I am YV staff" never grants anything.
- Redirect targets are validated as same-site paths.
- The Supabase advisor lists the `security definer` RPCs in `public`. This is intentional: each checks authorization inside, and signed-out users can't execute them.

## Not built yet

Co-investment syndication workspace, institutional partnerships pipeline, memo generator and PDF export, map, Google Calendar and Gmail sync, board role, per-user permission overrides, enforced MFA, signed-commitment and transferred-capital tracking, browser end-to-end test suite.

## Before production

- Set `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_SITE_URL` in hosting.
- In Supabase Auth: set the Site URL and redirect URLs, switch on Google, Apple and Microsoft, configure a custom SMTP sender, and enable leaked-password protection, CAPTCHA and MFA (see `docs/auth-setup.md`).
- Remove the test logins and sandbox organizations.

# What we took from Crunchbase, and what we didn't — 26 November 2026

Crunchbase was studied as a product, from its public pages only. No Crunchbase data or design was copied. Its terms prohibit scraping and storing its content, and its API licence forbids passing the data to third parties.

Sources read: [data.crunchbase.com](https://data.crunchbase.com/docs/welcome-to-crunchbase-data) (predictions, insights, API essentials), the [Crunchbase Pro page](https://about.crunchbase.com/products/crunchbase-pro), the [terms of service](https://about.crunchbase.com/docs/terms-of-service), and [Wikipedia](https://en.wikipedia.org/wiki/Crunchbase). The support-centre articles refused automated reading (HTTP 403), so Heat Score inputs and the full profile layout were not available.

## How Crunchbase is built

- **A linked graph:** organizations ↔ funding rounds ↔ investments ↔ investors (plus people, acquisitions, IPOs). A round has a type, an announced date, money raised (with a USD value), a pre-money valuation, and the investors in it.
- **Fields on each company:** `last_funding_at`, `last_funding_type`, `num_funding_rounds`, and press references. Search filters on these.
- **Discover:** structured filters (between, includes, blank…), natural-language search, saved lists, a Kanban tracker, notes and tags, and automatic notifications when a tracked company changes.
- **Predictions and insights:** funding, exit, growth, layoff and closure probabilities, plus investor insights with ranked "investor matches". The models are not published.
- **Export:** limited by plan (Pro: 2,000 rows a month).

## What we adopted, on YV's own sourced data

| Crunchbase concept | In this platform | Why it fits |
| --- | --- | --- |
| Funding rounds linked to investors | `funding_rounds` and `round_participants`. Every round **must cite** one of the company's public records (enforced by the database). A lead is marked only where the source says so. | Gives investors the funding history they look for first, without unsourced numbers. |
| `last_funding_at` / `num_funding_rounds` / total raised | Shown on portfolio cards, company pages, the startup list and next-round outlook. | The quickest read on a company's stage and momentum. |
| Investors per company / co-investor network | Insights page: which funds co-invest with YV most, disclosed capital by month and by sector. | Tells staff which local funds to bring into syndicates for international investors. |
| Lists and alerts | **Follow** a portfolio company. Followers are notified of new records and rounds. | One button, not a CRM. Staff see follow counts as a private interest signal, and the investor screen says so. |
| Search across entities | Staff search across companies, investors, records and co-investors. | One box instead of four lists. |
| Export | CSV of the portfolio funding summary and of investors, for staff only. Every export is logged in the audit log. | Was in the original specification and not yet built. |

## What we didn't adopt, and why

- **Opaque scores** (Heat, Growth, prediction probabilities): their weights are not published, and a number without reasons misleads. The existing next-round outlook already plays this role: it gives reasons and signals, and staff can edit it.
- **Valuations:** the sources rarely say whether a figure is pre- or post-money. One valuation is mentioned in a round note only.
- **People, acquisitions, IPOs, layoffs:** none exist yet for this portfolio.
- **Natural-language AI search, Kanban boards, tags:** that would become "another complex CRM".
- **Any Crunchbase data:** not licensed for this use.

## Data rules for rounds

- A round comes only from a record already on the company's page, and it links back to it.
- The date is when the source reported the round, labelled "reported". Close dates are kept in the note when the source gives them.
- `round_type` is filled only for The CarGo and Core AI ("seed" in the source).
- Several companies have two rounds from one article (Nav AI, Onless): an earlier check and a later one, as the article describes.
- Participant names are normalized (for example, "AloqaVentures" and "Aloqa Ventures" become one name) so the co-investor counts are right.

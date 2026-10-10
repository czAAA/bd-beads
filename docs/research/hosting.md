# Hosting for the public release (ticket 367)

Where the app, the Overview and the backend ([ADR 0014](../adr/0014-mvp-stays-local-only-hosted-phase-deferred.md)) run once the public can reach them, and which database the backend uses. This replaces `database-choice.md` (ticket 66), whose comparison is folded in below.

Fetched 2026-10-10 from each provider's own pricing, limits and terms pages (listed under Sources). Provider terms change; ticket 71 re-checks the chosen one when it opens the account.

## Recommendation

**One Cloudflare Worker serves everything. D1 holds the records and R2 holds the encrypted blobs. Start on Workers Free, and move to Workers Paid ($5 a month) when the daily request count nears the free cap, or on the first paying Pro account, whichever comes first.**

- **App host:** Workers static assets. The built `dist/` (the app and the Overview folder) is the Worker's assets directory. Requests for static assets are free and unlimited on both plans, and HTTPS is the provider's. The app, the Overview and the API share one origin, so the API needs no CORS. Vite's `base` becomes `/` on the public domain.
- **Backend host:** the same Worker runs the code under `/api/*`: View links, sync, accounts and settings, saved Palettes and the Polar webhook. A Cron Trigger deletes expired View links once a day.
- **Database:** D1 (SQLite) for accounts, settings, saved Palettes, plan status and an index of every blob (id, owner, version, size, `updated_at`, `last_opened_at`). **R2** holds the ciphertext of View links and synced Projects. ADR 0019 puts no limit on a Project's size, and D1 caps a row at 2 MB, so blobs go in R2 and not in D1 rows.
- **Cost:** $0 at 100 and 1,000 active people a month, and $5 a month at 10,000 (see the estimate). A domain comes on top, at registry cost through Cloudflare Registrar, which "does not mark up domain prices at all".

Why this one:

- It is the only candidate whose free tier allows commercial use (nothing in Cloudflare's terms forbids it) **and** covers static hosting, server code and both kinds of storage. At this app's sizes nothing else fits for free: Vercel Hobby forbids commercial use, GitHub Pages forbids SaaS, Supabase Free pauses, and Netlify Free can't afford a deploy on every push.
- Going over a free limit costs nothing. Requests fail until the reset at UTC midnight (Worker error 1027 on a route set to fail closed, which `/api/*` should be, and failed D1 queries), so nobody gets a surprise bill. That is also its risk: on a busy day, sync fails for everyone. Hence the move to Paid once traffic is real.
- After that, the paid step is $5 a month with large included amounts (10M requests, 25B D1 rows read, 50M rows written), not a $20–25 floor.
- D1 and R2 are managed storage separate from the Worker's code, so a broken deploy can't lose data. They are the same vendor as the host, though: a Cloudflare outage takes the app and the data offline together, without losing either. The app is local-first, so everyone keeps working on their device meanwhile; ADR 0014 accepts this. D1 Time Travel restores any minute of the last 7 days on Free and 30 days on Paid, at no cost.

**Runner-up: Workers for the host, with Turso as the database.** Turso's free tier also fits all three sizes, and its SQL is the same SQLite. It costs nothing extra, but it adds a second vendor, an account token as a secret and a network hop per query. Take it if leaving Cloudflare's database ever matters more than one bill. Blobs would still go to R2.

## Workload estimate

Assumptions, per active person a month. They are guesses, so the margins below matter more than the exact figures:

- **Visits:** about 8 sessions. One full load of the measured build is 0.62 MB gzipped (both pages and every bundled font), and later visits hit the browser cache for the hashed assets. Total: about 1 MB a month.
- **Accounts:** half of the active people sign in. 1 account in 10 is Pro, with 10 synced Projects; a Free account syncs 1. That makes about 0.95 synced Projects per active person.
- **Blob size:** a Project is 31 KB painted in blocks and 136 KB as random noise at 250 × 250 (ADR 0019). AES-GCM adds 28 bytes. Average: 50 KB.
- **Sync:** last-write-wins uploads of the whole Project, debounced to about 25 per session, so 200 writes a month per account. Each write is one Worker request, one R2 put and about 3 D1 rows written (the row plus its indexes). Opens on other devices, lists, settings and Palettes add about 50 requests a month per account.
- **View links:** 1 person in 4 makes 2 a month, and each is opened 4 times. Each open is one R2 get and one D1 write (`last_opened_at`). A link lives about 6 days on average (3 days after its last open), so about a fifth of a month's links exist at any time.
- **Polar webhooks:** a few events per Pro account a month. Negligible next to sync.

| Active people a month | 100 | 1,000 | 10,000 |
|---|---|---|---|
| Static transfer | 0.1 GB | 1 GB | 10 GB |
| Accounts (Pro) | 50 (5) | 500 (50) | 5,000 (500) |
| Synced Projects, stored | 95 · 5 MB | 950 · 48 MB | 9,500 · 475 MB |
| View links made · opened | 50 · 200 | 500 · 2,000 | 5,000 · 20,000 |
| View links, stored at once | 10 · 0.5 MB | 100 · 5 MB | 1,000 · 50 MB |
| Worker requests | 13k (≈ 430/day) | 130k (≈ 4.3k/day) | 1.3M (≈ 43k/day) |
| R2 writes (Class A) | 10k | 100k | 1.0M |
| R2 reads (Class B) | 3k | 30k | 300k |
| D1 rows written | 30k | 300k | 3.0M |

Against Cloudflare's free limits:

- **100 and 1,000:** under every limit by at least 10× (D1 and R2 writes; Worker requests by 23×). **$0.**
- **10,000:** the average day is 43% of the 100,000 daily Worker requests, so a busy day of 2–3× the average hits the cap. D1 writes (3.0M a month against 100k a day) and R2 writes (1.0M against 1M a month) are at their limits. **$5 a month on Workers Paid**, which covers the requests and D1 by a wide margin. R2's free tier stays free on any plan; about 5,000 Class A operations over it cost $0.02.
- Storage stays far below R2's free 10 GB and D1's 500 MB per database on Free. Only the index lives in D1, about 15,000 rows at 10,000 people.

## Candidates

| | Free tier, as it applies here | Commercial use on free | Overrun | Lock-in | Est. monthly cost (100 / 1k / 10k) |
|---|---|---|---|---|---|
| **Cloudflare Workers + D1 + R2** | Workers: 100k requests/day, 10 ms CPU per request, 5 Cron Triggers, unlimited static asset requests. D1: 5M rows read and 100k written a day, 500 MB per database, 5 GB total, 10 databases. R2: 10 GB-month, 1M Class A and 10M Class B a month, free egress | Allowed: no term forbids it, and the Developer Platform "can be used to host content" | Free: requests fail until 00:00 UTC, no charge. Paid ($5/month): 10M requests + $0.30/M; D1 +$1/M rows written, +$0.001/M read, +$0.75/GB-month past 5 GB; R2 $0.015/GB-month, $4.50/M Class A, $0.36/M Class B | Medium: bindings and the Worker runtime are Cloudflare's. D1 is SQLite (`wrangler d1 export` gives plain SQL) and R2 speaks the S3 API, so the data leaves easily; the code needs a thin adapter | $0 / $0 / $5 |
| **Turso** (database only) | 5 GB, 500M rows read and 10M written a month, 100 databases. Since March 31, 2025 free databases "stay responsive at all times" (no cold start). Its CLI docs still mention archiving after 10 days idle, which conflicts; an app in use daily never idles that long | Not restricted on the pricing page | Free: queries fail with `BLOCKED`. Developer $4.99/month (9 GB, 2.5B reads, 25M writes), then $1/M writes, $1/B reads, $0.75/GB | Low: libSQL is open source (`sqld`) and plain SQLite | $0 / $0 / $0, plus a host for the code |
| **Deno Deploy** | 1M requests, 20 GiB egress, 10 h CPU a month; Deno KV 1 GiB, 1M reads, 500k writes | "For personal use and smaller projects"; no explicit ban | Not stated for Free. Pro $20/month: 5M requests, then $2/M; KV writes $2.50/M past 2.5M | Medium: Deno KV is Deno's own | $0 / $0 / $20 (10k needs 1.3M requests and 1M writes) |
| **Vercel** | Hobby: 100 GB transfer, 1M function invocations, 4 h active CPU | **Forbidden**: "Hobby teams are restricted to non-commercial personal use only", and "any method of requesting or processing payment" counts | Hobby can't pay for more; Pro bills usage past its included credit | Medium | A Pro seat from day one (out on terms) |
| **Netlify** | 300 credits a month, a hard limit: 15 per production deploy, 20 per GB, 2 per 10k requests | Not stated | A hard limit with no auto recharge on Free; the page doesn't say what stops. Personal $9/month (1,000 credits), Pro $20/month | Low for static files | 20 deploys use the whole free month, and `deploy.yml` deploys every push to `main`: Personal $9 at every size |
| **GitHub Pages** (static only) | 100 GB/month soft, 1 GB site | **Forbidden**: not for "commercial software as a service (SaaS)" | — | Low | Out on terms once Pro is sold |
| **Supabase** (Postgres, auth, files) | 500 MB database, 1 GB files, 5 GB egress, 50k MAU | Not restricted | "Free projects are paused after 1 week of inactivity"; Pro from $25/month | Medium-high: auth, row-level security and storage are Supabase's | $0 with pause risk, or $25 |
| **Neon** (Postgres only) | 1 GB per project, 100 CU-hours, 5 GB egress; compute always scales to zero after 5 min | Not restricted | Free: compute suspends until next period, writes block past storage. Launch pay-as-you-go ($0.106/CU-hour, $0.35/GB-month) | Low: plain Postgres | $0 with cold starts, plus a host for the code |

Out early: **Firebase Firestore** (from ticket 66: daily quotas, then the Blaze plan's per-operation Google Cloud billing, which needs a billing account; it can't be self-hosted). **A Raspberry Pi at home** (ADR 0014: one home network and power supply is not a service to sell).

## Data model, carried over from ticket 66

- A Project is one blob, read and written whole by its owner. Nothing queries across Projects except "this account's list". View links are read by id.
- Since ADR 0037 the backend never sees what is in a Project, only ciphertext. So the blob is opaque bytes in R2, and D1 only holds who owns what, which version, and when.
- Accounts, settings, saved Palettes and plan status are small relational rows. Index the owner column: an unindexed list reads every row, and D1 bills rows read.
- Last write wins: store a `version` per synced Project, and reject a write based on a stale one (ticket 323). The column goes in from the start.
- Keep the SQL portable SQLite, so D1, Turso, a self-hosted `sqld` (Turso's open source server) and plain SQLite stay a config change.

## For ticket 81: what the plan limits cost

Storage doesn't drive the cost. At 50 KB a Project, a Pro account with 100 synced Projects stores 5 MB, and 10 GB of R2 holds 2,000 such accounts free. Writes do: every sync upload is a Worker request, an R2 Class A operation and about 3 D1 rows. So the number of synced Projects a Pro account gets matters less than how often a Project uploads. Keep the debounce, and the Free account's 1 synced Project costs about 200 writes a month. On Workers Paid, the $5 covers about 10M uploads a month (10M requests, and 50M D1 rows written at 3 per upload). R2 is billed apart: each 1M uploads past its free 1M costs $4.50.

## Not covered here

- **Email for sign-in** (magic links or password resets) is a cost the ticket didn't list. Ticket 78 picks the sign-in method and, if it needs one, an email sender.
- **Abuse:** View links need no account, so uploads are rate-limited (ticket 323). Cloudflare's Rate Limiting binding or a D1 counter does it. The estimate assumes honest use.
- **The 10 ms CPU limit on Free:** encryption runs in the browser, so a request only moves bytes and runs a query or two, well under 10 ms. Measure it in ticket 71; Paid lifts it to 30 s.

## Sources

Fetched 2026-10-10.

- Cloudflare Workers pricing (Workers, KV, D1, R2, Durable Objects): https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers limits (CPU, Cron Triggers, daily request limit and error 1027): https://developers.cloudflare.com/workers/platform/limits/
- Workers static assets billing ("Requests to static assets are free and unlimited"): https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- D1 limits (500 MB / 10 GB per database, 2 MB row): https://developers.cloudflare.com/d1/platform/limits/
- D1 Time Travel (7 / 30 days, no cost): https://developers.cloudflare.com/d1/reference/time-travel/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare service-specific terms, Developer Platform: https://www.cloudflare.com/service-specific-terms-developer-platform/
- Cloudflare Registrar: https://www.cloudflare.com/products/registrar/
- Turso pricing: https://turso.tech/pricing
- Turso Free tier changes, March 2025: https://turso.tech/blog/turso-cloud-debuts-the-new-developer-plan
- Turso usage and billing (`BLOCKED` on quota): https://docs.turso.tech/help/usage-and-billing
- Deno Deploy pricing: https://deno.com/deploy/pricing
- Vercel fair use guidelines (commercial usage): https://vercel.com/docs/limits/fair-use-guidelines
- Netlify credit-based plans: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Supabase pricing: https://supabase.com/pricing
- Neon pricing: https://neon.com/pricing

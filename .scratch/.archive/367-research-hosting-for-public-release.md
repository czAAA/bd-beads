# 367: Research: where the app and its backend run at public release

**What to build:** The pre-release build is tailnet-only on the router (ADR 0022), so the public can't reach it, and the backend has no host (ADR 0014). Estimate the workload and pick a host: free if one allows commercial use and fits, otherwise the least expensive that does. Write it to `docs/research/hosting.md`, folding in `docs/research/database-choice.md`.

The workload to estimate, at a few sizes of user base (say 100, 1,000 and 10,000 active people a month):
- static hosting for the app and the Overview;
- View links: encrypted blobs of a few KB to a few hundred KB (ADR 0019 has measured Project sizes), living 3 days after their last open;
- synced Projects (one per Free account, more for Pro) with last-write-wins updates;
- accounts, basic settings and saved Palettes;
- Polar webhooks and plan status.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Each candidate (at least: Cloudflare Workers with R2 or D1, Turso, and one or two others that fit) is checked against its current terms: free-tier limits, whether commercial use is allowed, what an overrun costs, and lock-in
- [x] A monthly cost estimate per user-base size for the top candidates
- [x] A recommendation for the app host, the backend host and the database, with sources
- [x] ADR 0014 names the choice, ADR 0022's status says where the public build goes, and ticket 71 is ready to start
- [x] The ticket is archived in the same change

**Done:** see `docs/research/hosting.md`. Recommendation: one Cloudflare Worker for the app, the Overview and the backend, D1 for records and R2 for encrypted blobs; $0 at 100 and 1,000 active people a month, $5 at 10,000 (Workers Paid). Runner-up database: Turso. `docs/research/database-choice.md` is folded in and removed (its Raspberry Pi section shrinks to one line, as ADR 0014 drops the Pi). Ticket 81 is unblocked from this one, and hosting.md says what its plan limits cost.

**Left out:** the cost of an email sender for sign-in (ticket 78 picks the sign-in method first), and measuring the Worker's CPU time per request against the Free plan's 10 ms (ticket 71, once there is code).

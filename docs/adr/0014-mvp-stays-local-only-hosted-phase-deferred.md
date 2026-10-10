# The hosted phase: what the backend does, who gets it, and what it runs on

**Status: accepted, not built.** Tickets 71, 78, 81, 82, 84, 323, 367. Code catches up in ticket 71 (host and database) and the tickets after it; the payout country check is open for ticket 81. Workload, prices and sources: `docs/research/hosting.md`.

The app is local-first ([ADR 0001](0001-local-only-persistence.md)); there is no backend yet. When there is one, it does only what cannot run on one device, and every feature that runs on the device stays there for everyone.

## What the backend does

- **View links** (CONTEXT.md): an encrypted snapshot anyone can create, a Guest included. It expires 3 days after it was last opened; every open restarts the clock, and an expired one has to be shared again as a new link. A short life keeps storage bounded without a plan or an account.
- **Synced Projects**, opened on another device through their **Edit link**; a signed-in device without the key lists a **Locked Project** ([ADR 0037](0037-projects-are-encrypted-in-the-browser-the-link-is-the-key.md)). Sync is per Project, not the whole library.
- **Settings kept in step** across a person's devices: theme, language, maker's name. Stored unencrypted, since they are not drawings; the privacy policy (ticket 82) says so.
- **Saved Palettes** ([ADR 0002](0002-palette-separate-from-bead-catalog.md)).
- Accounts, plan status from payment webhooks, and nothing else. It never sees a drawing.

## Who gets what

- A **Guest** gets everything on the device, and View links.
- A **Free account** adds what needs little of the backend: the basic settings kept in step and one synced Project.
- **Pro** adds what needs more: many synced Projects, saved Palettes, and later what professionals ask for, for someone who would rather not manage their work on each device.
- The exact limits are set from what the hosting costs, not fixed here. There is no free promo period.

## What it runs on

- **Host: one Cloudflare Worker** serves the app and the Overview as static assets and runs the backend under `/api/*`, on one origin. It starts on Workers Free, which allows commercial use and costs nothing, and moves to Workers Paid ($5 a month) when daily requests near the free cap or on the first paying Pro account, whichever is first: over a free limit, requests fail until midnight UTC instead of being billed. The rule that picked it: free if it allows commercial use and fits the estimated workload, otherwise the cheapest that does.
- **Storage: managed, separate from the Worker's code**, so a broken deploy doesn't take anyone's data with it. It is the host's vendor, so a Cloudflare outage takes the backend and its data offline together, without losing either; the app is local-first, so everyone keeps working on their device, and that is accepted for one bill and no network hop. **D1** (SQLite) holds accounts, settings, saved Palettes, plan status and the index of blobs. **R2** holds the ciphertext of View links and synced Projects, since a Project has no size limit ([ADR 0019](0019-a-pattern-has-no-size-limit.md)) and a D1 row does. The SQL stays portable SQLite, and R2 speaks the S3 API, so leaving Cloudflare moves data without a rewrite.
- **Payments: Polar** (merchant of record, Starter plan: 5% + 50¢, +1.5% on international cards, no monthly fee). A merchant of record is the legal seller and handles VAT and sales tax everywhere, which a solo maintainer can't. If Polar can't pay out to the maintainer's country (Stripe Connect), Paddle, at the same fee and model. Plan gating stays provider-agnostic: the backend stores a plan status per account from webhooks, so a switch changes only the webhook adapter.
- In the app, the backend is one more service implementation ([ADR 0020](0020-module-boundaries-and-a-services-layer.md)): the local ones stay, and the app keeps working without the remote one.

**Considered options**: a Raspberry Pi at home (dropped: one home network and power supply is not a service to sell); Turso as the database (runner-up: free at every estimated size, but a second vendor and a network hop for the same SQLite); Vercel Hobby and GitHub Pages (rejected: their terms forbid commercial use); Netlify Free (rejected: its credits don't cover a deploy on every push to `main`); Supabase Free (rejected: it pauses when idle); Deno Deploy (rejected: it costs more than Workers Paid at the larger sizes); library-wide "paired accounts" sync (dropped: end-to-end encryption would need an account-level key, which ADR 0037 rejects); paywalling hosted links by size (dropped with QR sharing: a View link is free and short-lived instead); Stripe Billing and Tax (rejected: the maintainer would be the seller and own tax filing everywhere); Lemon Squeezy (rejected: extra fees stack, and its future under Stripe is uncertain).

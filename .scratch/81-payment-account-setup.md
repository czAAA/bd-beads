# 81: Create the Polar account and the Free account / Pro plans

**What to build:** Sign up for Polar (merchant of record, ADR 0014) and define the plans: a Free account gets the backend features that cost little (basic settings in step, one synced Project), Pro gets more (many synced Projects, Palettes saved to the account). The limits come from the cost estimate in `docs/research/hosting.md` (ticket 367): what drives cost is how often a synced Project uploads, not how many there are. There is no free promo period.

**Blocked by:** 78 (Accounts and settings sync)

**Status:** ready-for-human

- [ ] Polar pays out to the maintainer's country (Stripe Connect); if not, Paddle is used instead and ADR 0014 says so
- [ ] A Polar organisation exists and is verified for live payments
- [ ] The Pro plan and its price are defined, and the Free account and Pro limits are written into ADR 0014
- [ ] An access token and webhook secret are ready for ticket 84
- [ ] The ticket is archived in the same change

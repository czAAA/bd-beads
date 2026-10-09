# 71: Provision the backend host and database

**What to build:** Set up the host and the managed database that ticket 367 picks, ready for the backend to deploy to, so View links, accounts and sync have somewhere to run (ADR 0014). The Raspberry Pi of the first plan is dropped: a home network and power supply is not a service to sell.

**Blocked by:** 367 (Research: hosting and database for the public release)

**Status:** ready-for-human

- [ ] The host chosen in ticket 367 has an account, and the app's backend can deploy to it
- [ ] The managed database chosen in ticket 367 exists and is reachable from the host only
- [ ] The database is backed up
- [ ] `docs/deploy.md` says how to deploy the backend
- [ ] The ticket is archived in the same change

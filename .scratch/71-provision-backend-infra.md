# 71: Provision self-hosted backend infra (Pi + managed DB)

**What to build:** Set up the physical, self-hosted server (Raspberry Pi: OS, networking, reachability) and create the managed free-tier database account chosen in ticket 66, ready for the backend app to deploy to. Intentionally not started until after MVP ships, per ADR 0014.

**Blocked by:** 66 (Research: database type + free-tier provider)

**Status:** ready-for-human

- [ ] Raspberry Pi is set up, on the network, and reachable for deployment
- [ ] A managed free-tier database account (per ticket 66's recommendation) exists and is reachable from the Pi
- [ ] Basic backup of the database is configured

# 66: Research: what database type + free-tier provider fits the backend phase

**What to build:** Investigate what kind of database bd-beads' future backend actually needs (Pattern data is small, JSON-shaped blobs — evaluate relational vs. document/NoSQL fit), and compare free-tier providers (e.g. Supabase, Turso, Neon, Firebase/Firestore, Cloudflare D1) on capacity, cost cliff, and compatibility with self-hosting the app server on a Raspberry Pi. Capture findings and a recommendation as a research doc/ADR.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] At least three free-tier providers are compared against bd-beads' actual data shape and expected scale
- [ ] Findings state what stays free indefinitely vs. what triggers a paid tier
- [ ] A recommendation is written down and ready to hand to ticket 71

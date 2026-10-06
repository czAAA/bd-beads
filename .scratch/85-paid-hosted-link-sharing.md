# 85: Gate unlimited-size hosted-link sharing behind paywall

**What to build:** The first paid feature: for paid-plan users, QR export offers a hosted-link option (ADR 0015) with no size cap, instead of the compact-encoding QR from ticket 68.

**Blocked by:** 323 (End-to-End Encryption in the Browser: hosted links are encrypted, the key stays in the link), 68 (QR export), 84 (Integrate payment processor + subscription/plan gating)

**Status:** ready-for-agent

- [ ] A paid-plan user can export any Pattern, regardless of size, as a QR code linking to a hosted copy
- [ ] A free-plan user still gets ticket 68's capped, no-backend QR behavior
- [ ] Scanning the hosted-link QR on another device successfully retrieves the Pattern

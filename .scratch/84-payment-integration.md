# 84: Subscribe to Pro, and gate backend features by plan

**What to build:** A signed-in person can subscribe to Pro through Polar, and the backend features follow the plan: a Free account syncs one Project, Pro syncs many and saves Palettes to the account (ADR 0014). Nothing that runs on the device is ever gated (ADR 0001). The backend stores a plan status per account from Polar's webhooks, so switching provider changes only the webhook adapter.

**Blocked by:** 81 (Polar account and plans)

**Status:** ready-for-agent

- [ ] A signed-in person can subscribe to Pro, and the payment goes through
- [ ] The app reads a signed-in person's plan and offers each backend feature accordingly; a Free account that reaches its limit is told what Pro adds
- [ ] Plan status stays correct across sign-in, sign-out, renewal and cancellation
- [ ] What happens to a cancelled Pro's synced Projects beyond the Free account's one is decided (by grilling) before this is built, and recorded in ADR 0014
- [ ] The ticket is archived in the same change

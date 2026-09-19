# 84: Integrate payment processor + subscription/plan gating

**What to build:** Wire up the payment processor from ticket 81 and build the plan-gating logic that lets specific features be restricted to paid accounts.

**Blocked by:** 81 (Create payment processor account + plan structure), 65 (Codebase architecture review)

**Status:** ready-for-agent

- [ ] A user can subscribe to the paid plan and payment is processed correctly
- [ ] The app can check a signed-in user's plan and gate a feature accordingly
- [ ] Plan status stays correct across sign-in/sign-out and renewal/cancellation

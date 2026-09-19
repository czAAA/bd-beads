# 65: Codebase architecture review: decide module/component/service boundaries

**What to build:** A collaborative session (agent + human, using the `codebase-design` skill) that reviews the current codebase and decides how it should be organized into modules/components/services as backend, accounts, and billing work land on top of it in later tickets. The output is a documented target structure, not a code change.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Current code structure has been walked through and its seams identified
- [ ] A target module/component/service boundary is agreed and written down (e.g. as an ADR or a doc)
- [ ] The decision explicitly covers where a future backend-facing "services" layer would live, distinct from domain logic and UI components

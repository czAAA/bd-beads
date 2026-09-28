# 174: Disable Mirror tool pending redesign

**What to build:** Hide/disable the Mirror tool group in the UI. The underlying Mirror domain logic (ADR 0006) stays in the codebase for the future redesign; only the user-facing controls are removed.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Mirror tool group no longer appears in the Toolbox
- [ ] No remaining UI entry point can enable Mirror
- [ ] Existing saved patterns with mirror state open without error

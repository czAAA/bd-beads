# 65: Codebase architecture review: decide module/component/service boundaries

**What to build:** A collaborative session (agent + human, using the `codebase-design` skill) that reviews the current codebase and decides how it should be organized into modules/components/services as backend, accounts, and billing work land on top of it in later tickets. The output is a documented target structure, not a code change.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Current code structure has been walked through and its seams identified
- [x] A target module/component/service boundary is agreed and written down (e.g. as an ADR or a doc)
- [x] The decision explicitly covers where a future backend-facing "services" layer would live, distinct from domain logic and UI components

**Progress:** ADR 0020 is accepted. Before agreeing, it was refreshed against the code after the App.vue split (ADR 0023). `services/` now covers all device storage (theme, language and maker name as well as the Pattern library) and image decoding. The code moves are ticket 207.

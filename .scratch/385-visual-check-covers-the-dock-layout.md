# 385: The visual check covers the Dock layout

**What to build:** the e2e helpers (`e2e/support/`) drive the Toolbox, so ticket 383 builds the visual check with `VITE_DOCK_LAYOUT=off`. Port the helpers to the Dock and its sheets, regenerate the references on Linux, drop the override from `.github/workflows/ci.yml` and `e2e/support/server.ts`, and skip the Toolbox layout's e2e while the flag is on.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Checklist

- [ ] E2E helpers drive the Dock layout
- [ ] References updated, and the PR says so (`docs/testing.md`)
- [ ] `VITE_DOCK_LAYOUT=off` removed from CI and the e2e server

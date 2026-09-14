# 04: Set up and deploy the app to GitHub Pages

**What to build:** Determine whether this app — a client-only SPA with no backend, per [ADR 0001](../../../docs/adr/0001-local-only-persistence.md) — can be hosted on GitHub Pages, and if so, get it built and published there. Cover both the one-time setup (build config for Pages' subpath hosting) and a repeatable way to publish future changes, not just a single manual upload.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Confirm GitHub Pages is workable for this app's requirements (static hosting only, localStorage-based persistence, no server) and note any blockers found
- [ ] Vite build config (`base`, asset paths) is set correctly so the built app resolves its assets when served from a GitHub Pages URL, not just from `/`
- [ ] A repeatable deploy path exists (e.g. a GitHub Actions workflow, or a documented `npm run deploy` script) so later changes can be republished without manually copying files
- [ ] The app is live and reachable at a GitHub Pages URL
- [ ] README documents how to deploy and links the live URL

# Works offline

Moved here from the README, which keeps a short version.

bd-beads is local-first (ADR 0001): every Project lives in the browser, so the app opens and works with no internet, and when our hosting is down, from the copy the service worker cached (ticket 69). Only what needs the backend (View links, sync, accounts; ADR 0014) stops, and says so with a message (ticket 381). The first visit needs a network once. Limits that cost money are enforced on the server, never in this code (ADR 0044).

To try it: open the built app (`npm run build && npm run preview`), load it once, switch the browser to offline in DevTools (Network), and reload. Chrome's Application tab shows the worker (`sw.js`), its cache and the manifest. The first visit needs the network once; the offline copy then downloads silently behind the app.

The app can be installed from the browser (Chrome's install button, "Add to Home Screen" in iOS Safari) and then opens like any other app. A new version downloads in the background and shows "Update ready, Reload" in the open tab; it also arrives by itself the next time the app is opened. How it works and why it is hand-written: ADR 0045. The worker is only built and registered in production builds, so `npm run dev` never caches anything.

The check that runs all of this in a browser is `e2e/visual/offline.spec.ts`: [`docs/testing/browser-checks.md`](testing/browser-checks.md), The offline shell.

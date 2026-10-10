# 69: The app installs, and works fully with no internet or with our hosting down

**What to build:** Add a web app manifest and a service worker so bd-beads can be installed to a home screen or desktop, and so it loads and works completely, from the last version saved on the device, when there is no network or when our hosting is down (ADR 0001, ADR 0014). Every Pattern already lives on the device, so nothing is lost; the point is that a refresh must still open the app. Only what needs the backend (ticket 381) stops working. This is the main goal of the ticket.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Behaviour

- **Offline shell:** the build is precached (Workbox through `vite-plugin-pwa`, or a hand-written worker if that keeps the app free of a new dependency; knip stays clean). `index.html` is network-first, hashed assets are cache-first, so a hosting outage serves the last cached copy. The Overview (ADR 0040), the lazy chunks and the bundled fonts are all in the precache.
- **Updates:** no `skipWaiting`. A new version activates on the next full load, and an open tab shows a quiet "Update ready, reload" prompt. Saved-data migrations stay forward-compatible for one version, so an old tab and a new tab can share the library.
- **First visit:** the browser's own error if there is no network; a worker cannot exist before the first load. The offline copy downloads silently in the background after the app starts, with no message about it.
- **Splash before the code arrives:** `index.html` carries an inline splash: the three loading beads from the design system (`Loading` card: `accent`, swell in turn, still with reduced motion) in the middle of the page on the theme background the inline script already picks. It appears only after `loading-delay` (300 ms), has no external request, and is removed when the app mounts. Light theme `accent` is orange and dark theme's is yellow, as the design system defines them.
- **Size budget:** `index.html` including the splash stays under 14 KB (the first round trip), asserted by a unit test on the build output.
- **Storage:** ask the browser for persistent storage (`navigator.storage.persist()`) so the library is not evicted; the privacy copy (ticket 82) says so.
- **Installable:** manifest with the icons from `docs/design/system/`, `display: standalone` and the theme colour from the tokens. Checked on Chrome desktop, Chrome on Android and iOS Safari ("Add to Home Screen"). No push, no background sync and no install button here.
- **External links** (source, privacy policy) open normally and show the browser's own error offline.

## Acceptance

- [ ] The app is installable on at least one mobile and one desktop browser
- [ ] After one load, with the network off, and separately with every `/api/*` and the host answering 503, a reload opens the app and a Pattern can be created, edited, saved and opened again
- [ ] The Overview opens offline
- [ ] An update is picked up on the next load without uninstalling; an open tab offers "Update ready, reload"
- [ ] A Playwright test covers the offline and host-down cases above (service worker in control, network off)
- [ ] A unit test asserts every file in the build output is in the precache list
- [ ] The splash shows the loading beads from the design system after 300 ms, follows the theme, and `index.html` stays under 14 KB, asserted by a test
- [ ] `navigator.storage.persist()` is requested
- [ ] The ticket is archived in the same change

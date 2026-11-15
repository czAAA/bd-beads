# Browser checks outside the usual run

Part of the testing docs; the rules every test follows are in [`docs/testing.md`](../testing.md).

## The offline shell

`e2e/visual/offline.spec.ts` (part of `npm run visual`, ticket 69) is the one check that lets the service worker run (the others block it, in `playwright.config.ts`). It loads the production build once, waits for the worker to take control, then reloads with the network off and again with our hosting answering 503 (`e2e/support/hostProxy.ts` stands in front of the preview and can be taken down, slowed, or made to serve a new worker), and creates, edits, saves and reopens a Schema. It also checks the Homepage, installability, the persistent-storage request at the first save (after its note), "Update ready" and the splash in both themes. `vite.pwa.test.ts` builds the app and asserts every built file is in the worker's list and `index.html` is under 14 KB.

## Popups in real Safari (manual, ticket 0804)

Playwright's WebKit places an anchored popup (the Frame tools menu and the other MenuButton menus, panel pickers, the margin colour popover) correctly, but real Safari painted it at the window's corner for a few frames and then jumped. No CI check can catch that, so `e2e/visual/anchoredPopup.spec.ts` only pins the place in Chromium (full editor and What's inside), and `scripts/safari-popup-check.mjs` runs the real loop on macOS: it drives Safari through `safaridriver`, clicks the Frame tools "…" and reads the menu's place on every animation frame, failing on any frame that is not 4px under the button. One-time setup: Safari > Develop > "Allow Remote Automation". Then `npm run build && npx vite preview --host 127.0.0.1 --port 4173`, `node scripts/safari-popup-check.mjs`.

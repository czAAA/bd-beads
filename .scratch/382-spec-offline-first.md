# 382: Spec: the app works with no internet or with our hosting down, and server features fail gently

**What to build:** The spec behind tickets 69 (the installable offline shell) and 381 (server features that fail gently). Decided in a grilling session; ADR 0044 records the abuse stance and the sync convention.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Problem Statement

bd-beads keeps every Project in the browser (ADR 0001), yet a refresh with no internet, or while our hosting is down, shows the browser's error page instead of the app, so the artist cannot reach their own work. Later, the features that do need the backend (View link, sync, login, saved Palettes) will each have to cope with a missing network, and without one shared way they will each do it differently, or fail silently. A person must also not wonder whether work is lost when the server cannot be reached. And because the app is a public, modifiable client, the owner needs a clear answer to how it is guarded against abuse.

## Solution

The app opens and works fully from the last version saved on the device, with no internet and while our hosting is down. It can be installed to a home screen or desktop. The first visit needs the network once; a quiet splash of the three loading beads shows until the app appears. Features that need the backend stay clickable; when one cannot reach the server, a toast says why, and when the cause is our hosting, says the work is safe on this device and offers Save. A synced Project shows Sync pending until its changes arrive, and Pro syncs again by itself without repeating toasts. Anything that costs money or touches other people is limited by the server on every request; the client only shows those limits.

## User Stories

1. As an artist on a train with no signal, I want to reload the app and keep drawing, so that a lost connection never blocks my work
2. As an artist, I want the app to open when bd-beads' hosting is down, so that an outage on your side doesn't stop my work
3. As an artist, I want to install the app to my home screen or desktop, so that it opens like any other app
4. As an artist on an iPad, I want "Add to Home Screen" to give a standalone app with the right icon, so that it feels native
5. As an artist, I want a Pattern I create, edit and save offline to be there after a reload, so that I can trust the app offline
6. As an artist, I want the Overview to open offline too, so that no page of the app is a dead end
7. As an artist opening the app for the first time on a slow connection, I want to see a moving indicator instead of a blank page, so that I know it is loading
8. As an artist on a fast connection, I want no flash of a splash, so that quick loads stay quiet
9. As an artist using the dark theme, I want the splash on the dark background with yellow beads (orange on light), so that it matches the app
10. As an artist who prefers reduced motion, I want the splash beads to stand still, so that nothing moves against my setting
11. As an artist, I want a new version to arrive on my next load without reinstalling, so that I keep getting fixes
12. As an artist with the app open in a tab, I want a quiet "Update ready, reload" prompt and no forced reload, so that I don't lose my place
13. As an artist with two tabs on different versions, I want the saved library to still open in both, so that an update never breaks my data
14. As an artist, I want the browser asked to keep my saved Projects from being cleared, so that storage pressure doesn't delete my work
15. As an artist, I want the offline copy to download silently, so that I'm not confused by extra messages
16. As an artist who presses Share or Sync with no internet, I want a toast saying I'm offline, so that I know why nothing happened
17. As an artist whose server is down, I want a toast saying my work is safe on this device with a Save button, so that I can keep a copy
18. As an artist, I want server features to stay clickable and explain themselves on failure, so that I can discover what exists
19. As a Pro user, I want my synced Project to push after my edits and retry on its own, so that I never press Sync by hand
20. As a Pro user whose sync fails for an hour, I want one failure toast and one success toast, so that I'm not spammed
21. As a Pro user, I want a "Sync pending" banner while changes are waiting and "Synced" when they arrive, so that I can see the state at a glance
22. As a Free-account user, I want my one synced Project to sync when I press Sync and to work once the server is back, so that I control when it happens
23. As a user with two devices, I want edits to different rows of the same Pattern on both to survive a sync, so that offline work on two devices doesn't clash
24. As a user, I want a deleted row to stay deleted after a sync with an older copy, so that old devices don't bring it back
25. As a Guest, I want nothing about my drawing features limited or checked, so that everything on the device stays free
26. As the owner, I want every cost-bearing limit enforced by the server on every request, so that editing the client's code gains an abuser nothing
27. As the owner, I want the server to read the plan from payment webhooks and never from the client, so that no one can claim Pro
28. As the owner, I want a modified client to be able to damage only its own encrypted data, so that tampering never touches other people
29. As a developer, I want one result type for every remote service, so that no feature writes its own network error handling
30. As a developer, I want one place for the failure wording in every language, so that the messages stay consistent
31. As a developer, I want a test that fails if a built file is missing from the offline copy, so that a new asset can't silently break offline use
32. As a developer, I want a test that holds index.html under 14 KB, so that the first paint stays in one round trip
33. As a developer, I want a documented way to try the app offline, so that anyone can check it by hand
34. As an artist using a screen reader, I want the splash and banners to be announced politely or hidden as decoration, so that they don't get in the way

## Implementation Decisions

- **Offline shell (69):** the built app, the Overview, the lazy chunks and the bundled fonts are precached by a service worker. The page document is network-first and hashed assets are cache-first, so a hosting outage serves the last cached copy. A new version activates on the next full load; an open tab shows "Update ready, reload". Saved-data migrations stay forward-compatible for one version. The offline copy downloads silently; the first visit needs the network once.
- **Installable (69):** a manifest with the design-system icons, standalone display and the token theme colour; persistent storage is requested. No push, background sync or install button.
- **Splash (69):** inline in the page document, the Loading card's three beads centred on the theme background, shown after the 300 ms loading delay, no text, removed when the app mounts. `index.html` including it stays under 14 KB. The design system's Loading card and changelog already say so.
- **Remote services (381):** every service that reaches the backend returns a result that is ok or a failure with a reason (offline, unavailable, signed-out, plan-limit); none throws into the UI. Composables map a failure to one toast; components never touch the network. The app keeps no connectivity indicator and does not poll; it learns the server is unreachable when a call fails. Features are never disabled.
- **Failure wording:** one table of messages per reason in every language; "unavailable" adds that the work is safe on this device and offers Save (the existing Project export).
- **Sync (later tickets 323, 78):** each synced Project keeps one pending-changes flag, pushes after edits settle and retries on the next edit, on focus, on regaining the network and with backoff. Background sync toasts only the first failure and the first success after it, with the Sync pending banner between. A Free account syncs on a press; Pro syncs automatically. Records carry a version and a random nonce (higher version wins, lower nonce breaks a tie), deletions stay as tombstones, the unit is a row of the Pattern plus one record per other part, and a push built on a stale server version makes the client pull, merge and push again. The server never merges.
- **Abuse (ADR 0044):** local features are not guarded. Everything that costs money or touches others is limited on the server: plan from webhooks, per-account quotas, rate limits per IP and account, 3-day expiry of View links, a hard storage cap. The client mirrors limits for courtesy only.
- **Terms:** Sync pending (glossary). Existing terms Guest, Free account, Pro, View link, Edit link are used as defined.
- **Docs:** README says how to try offline; the privacy policy (82) says what stays on the device and what the server keeps.

## Testing Decisions

- **Seams (proposed, for the owner to confirm):** (1) the built app in a real browser through the existing Playwright setup, for everything about the offline shell, the splash and the build checks; (2) the remote-service interface with a fake implementation (the seam ADR 0020 already prescribes for composables), for failure reasons, toasts, the banner and retries. No new seam is added.
- A good test checks what a person sees or can do: the app opens and a saved Pattern is back with the network off; the toast shows after a failing call. It doesn't assert how the worker or retry loop is built.
- Seam 1: load once, wait for the worker to take control, then with the network off and separately with `/api/*` and the host answering 503, reload; create, edit, save and reopen a Pattern; open the Overview; check the splash after 300 ms follows the theme; check an update prompt appears for a new version. A build-output test asserts every built file is in the offline list and `index.html` is under 14 KB.
- Seam 2: a fake service returning each failure reason shows the right toast in EN and RU with no feature code; a failing-then-recovering sync shows exactly one failure toast, the banner between, and one success toast, however many retries; merge cases (different rows both survive, a tombstone beats a stale copy, a tie goes to the lower nonce) belong to the sync ticket that builds it.
- Prior art: `e2e/visual` and `e2e/support` (Playwright over a shared build), `docs/testing.md` ("test at the highest seam that already exists"), composable tests with fake services (ADR 0020).

## Out of Scope

- Building the backend, accounts, payments, View links and sync (71, 78, 84, 323); this spec only fixes how they must behave when the server is missing.
- Live co-editing between people.
- Push notifications, background sync, a custom install button.
- A connectivity indicator or disabled states.
- Tamper-proofing local features.
- Making the first-ever visit work with no network (impossible).

## Further Notes

- Tickets 69 and 381 implement this spec. The "Not synced yet" wording was replaced by Sync pending and Synced; the toast button reads Save.
- Dot colours come from the design system's `accent` (orange light, yellow dark).
- Excalidraw's reconcile-and-save loop is the convention for sync.

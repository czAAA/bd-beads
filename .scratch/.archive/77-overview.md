# 77: Overview

**What to build:** The Overview (see `CONTEXT.md`): a page outside the editor, at `/overview` under the app's base path, that introduces bd-beads feature by feature to someone new to it, following ticket 208's Overview card. It is the front door for a new visitor and the way into the Tour (ticket 80). There are no accounts, so "new" means this device's Pattern library is empty.

**Blocked by:** 208 (Design system v15: Overview, Tour and the header menu), 209 (English as the default language), 210 (Header menu replaces the More menu)

**Status:** done

**Who sees it:**

- Anyone who opens `/overview` directly, at any time.
- A visitor who opens the app's main address while the Pattern library is empty **and** the Tour has been neither finished nor turned off on this device: they are sent to the Overview instead of the editor. Otherwise the main address opens the editor as today.

- [x] `/overview` serves the Overview on the static host (no server, ADR 0001, ADR 0022), including when opened directly or reloaded
- [x] The main address sends a visitor to the Overview under exactly the rule above, and never otherwise
- [x] The primary button reads "Make your first Pattern" and opens the editor with the Tour started at step 1; the secondary "Open the editor" opens the editor without it. With Patterns already saved, the primary reads "Open the editor" and there is no Tour button
- [x] One line per feature, each with its Icons v2 icon and the design system's description, in this order: Techniques, Pattern editing, Convert image, Row progress, Beads needed, Exports, Saved Patterns (stay on this device, no account). Mirror is not listed while its controls are hidden (ticket 174)
- [x] The header holds the X1 logo, the header menu (ticket 210), Language and Theme, sharing the app's saved language and theme choice; no Keyboard shortcuts button
- [x] This ticket adds the Overview item to the header menu, opening this page from the editor
- [x] English and Russian, starting in English on a device with no saved language (ticket 209)
- [x] Correct at all five screen sizes and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [x] Uses the tokens, type roles, X1 mark and theme-aware favicon, with no other logo or borrowed imagery and no screenshots, and loads no third-party fonts or scripts

## Notes from the build

- `/overview` is a second Vite page (`overview/index.html`), so a static host serves `/bd-beads/overview/` with no rewrite rules. Reloading and opening it directly work the same way.
- The main address decides in `src/main.ts` through `shouldOpenOverview` (`src/overview/overviewRoute.ts`). Both buttons on the Overview mark the tab as having chosen the editor (session storage), so the editor doesn't bounce the visitor straight back while the library is still empty.
- The Tour's device status lives in `src/services/tourStore.ts` (`untouched`, `running`, `finished`, `off`). "Make your first Pattern" writes `running`; ticket 80 reads it, starts at step 1 and writes `finished` or `off`.
- The page holds the slogan, the "save. count. export" line, the two buttons, and the seven features as a list, one line each. The carousel with drawn examples, the coffee tile, the plans and the hand-drawn layer from the Overview card are not part of this ticket's criteria and are not built.
- The header menu is now shown at every size and ends with an Overview link. At 1024px and up it holds only that link. Take the tour joins it in ticket 80.
- `index.html` started the page in Russian when no language was saved; it now starts in English, as ticket 209 intended.

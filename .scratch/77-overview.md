# 77: Overview

**What to build:** The Overview (see `CONTEXT.md`): a page outside the editor, at `/overview` under the app's base path, that introduces bd-beads feature by feature to someone new to it, following ticket 208's Overview card. It is the front door for a new visitor and the way into the Tour (ticket 80). There are no accounts, so "new" means this device's Pattern library is empty.

**Blocked by:** 208 (Design system v15: Overview, Tour and the header menu), 209 (English as the default language), 210 (Header menu replaces the More menu)

**Status:** ready-for-agent

**Who sees it:**

- Anyone who opens `/overview` directly, at any time.
- A visitor who opens the app's main address while the Pattern library is empty **and** the Tour has been neither finished nor turned off on this device: they are sent to the Overview instead of the editor. Otherwise the main address opens the editor as today.

- [ ] `/overview` serves the Overview on the static host (no server, ADR 0001, ADR 0022), including when opened directly or reloaded
- [ ] The main address sends a visitor to the Overview under exactly the rule above, and never otherwise
- [ ] The primary button reads "Make your first Pattern" and opens the editor with the Tour started at step 1; the secondary "Open the editor" opens the editor without it. With Patterns already saved, the primary reads "Open the editor" and there is no Tour button
- [ ] One line per feature, each with its Icons v2 icon and the design system's description, in this order: Techniques, Pattern editing, Convert image, Row progress, Beads needed, Exports, Saved Patterns (stay on this device, no account). Mirror is not listed while its controls are hidden (ticket 174)
- [ ] The header holds the X1 logo, the header menu (ticket 210), Language and Theme, sharing the app's saved language and theme choice; no Keyboard shortcuts button
- [ ] This ticket adds the Overview item to the header menu, opening this page from the editor
- [ ] English and Russian, starting in English on a device with no saved language (ticket 209)
- [ ] Correct at all five screen sizes and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [ ] Uses the tokens, type roles, X1 mark and theme-aware favicon, with no other logo or borrowed imagery and no screenshots, and loads no third-party fonts or scripts

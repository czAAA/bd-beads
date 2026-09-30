# 210: Header menu replaces the More menu

**What to build:** A menu button with the new `menu` icon next to the logo, at every screen size, replacing the header's More menu. Below 1024px (where More is today) it holds everything More holds there, plus Overview and Take the tour; at 1024px and up only Overview and Take the tour, for now. Built on the shared `AppMenu`, following ticket 208's header menu card.

**Blocked by:** 208 (Design system v15: Overview, Tour and the header menu)

**Status:** done

**Overview / Tour:** the menu is how people reach both: Overview opens ticket 77's page, Take the tour starts ticket 80's Tour from step 1. Tickets 77 and 80 each add their own item; until the first of them lands, the menu has nothing to hold at 1024px and up, so the button shows there only once it has an item.

- [ ] The More menu is gone; the menu button sits next to the logo at every screen size, drawn with the design system's `menu` icon
- [ ] Below 1024px the menu holds everything More held at that size (Import, Language, Theme, Name on exports, and Keyboard shortcuts on the phone), in the order the header menu card gives
- [ ] At 1024px and up it is meant for Overview and Take the tour only (added by 77 and 80), and the header's own controls stay where they are
- [ ] Keyboard and screen reader behavior follow the `Menu` card, as the More menu does today
- [ ] Correct in the light, dark and high contrast themes

# 137: Icon component and Icons v2

**What to build:** One shared Icon component draws any of the Icons v2 from `docs/design/system/assets/Icons/` inline with `currentColor`, at the sizes in the design system README's Iconography (14, 15, 16, 17, 18). Later tickets use it instead of drawing their own SVGs. Nothing is migrated in this ticket, but the component is shown working in the app (for example on one existing button) so it is verifiable on its own.

**Blocked by:** 136

**Status:** done

**Design system v13:** the design system has 44 icons, including `device` and `contrast` for the theme control; `row-progress` is dropped, so the app has 43.

- [x] Every icon is available by name, with stroke 1.75, round caps and joins, no fill, and `stroke: currentColor` so they follow the text color in both themes
- [x] The bead-dot details (zero-length round-cap strokes) render correctly at every size
- [x] Icons that are decorative are hidden from assistive tech; icon-only buttons take their accessible name from their own label
- [x] A test or preview lists every icon so a missing or misspelled name fails
- [x] The `row-progress` icon is not used for new UI (the design system README's Iconography)
- [x] All 43 Icons v2 in the repo are available by name (`AppIcon`, since the lint rule wants multi-word component names)

# 137: Icon component and Icons v2

**What to build:** One shared Icon component draws any of the 40 Icons v2 from `docs/design/system/assets/Icons/` inline with `currentColor`, at the sizes in `DESIGN.md` §6.1 (14, 15, 16, 17, 18). Later tickets use it instead of drawing their own SVGs. Nothing is migrated in this ticket, but the component is shown working in the app (for example on one existing button) so it is verifiable on its own.

**Blocked by:** 136

**Status:** ready-for-agent

**Design system v13:** there are 45 icons, including `device` and `contrast` for the theme control; `row-progress` is dropped.

- [ ] All 40 icons are available by name, with stroke 1.75, round caps and joins, no fill, and `stroke: currentColor` so they follow the text color in both themes
- [ ] The bead-dot details (zero-length round-cap strokes) render correctly at every size
- [ ] Icons that are decorative are hidden from assistive tech; icon-only buttons take their accessible name from their own label
- [ ] A test or preview lists every icon so a missing or misspelled name fails
- [ ] The `row-progress` icon is not used for new UI (§6.1)
- [ ] All 45 Icons v2 are available by name

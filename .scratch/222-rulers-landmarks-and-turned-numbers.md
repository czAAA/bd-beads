# 222: Rulers: landmark numbers, turned column numbers, phone size

**What to build:** The canvas rulers follow the approved Rulers design (variant A). Every number is still drawn. Every 5th number is bold in `body`; the rest are regular in `ruler`; the current row's number stays bold in `marker`. Column numbers up to 99 stay horizontal; from 100 they are turned a quarter turn and read upward, so three digits take no more width than two, and sit at the bead-side end of the gutter just like the horizontal ones. Row numbers never turn. On a phone the numbers are 12px, everywhere else 11px. The keyboard cursor's number keeps its bold `ink` with the `focus-ring` underline, also when turned (the underline stays under the digits in their own reading direction).

**Blocked by:** None (can start immediately). The Rulers card and `bead-min-*` tokens were added to `docs/design/system/` by hand from the approved design; the next sync from claude.ai (`DESIGN.md` §6) replaces them.

**Status:** ready-for-agent

- [ ] Every 5th row and column number is bold in `body`; the others are regular in `ruler`
- [ ] The current row's number and the cursor's number keep their own styles over the 5th-number style
- [ ] Column numbers from 100 are turned and read upward; up to 99 and every row number stay horizontal
- [ ] Turned and horizontal numbers sit the same distance from the board on the top and bottom rulers, with every Technique's half-bead shift still applied
- [ ] The cursor underline sits under the digits, in their own reading direction, for horizontal and turned numbers alike
- [ ] The numbers are 12px at the phone tier (below 744px) and 11px above it, chosen in CSS, with no per-tier size in script
- [ ] Verified in a browser, in light, dark and high contrast, with the Pattern turned
- [ ] Uses the design system tokens and type roles only
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no, not added to the Overview or the Tour

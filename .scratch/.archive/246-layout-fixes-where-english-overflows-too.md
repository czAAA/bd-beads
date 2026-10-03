# 246: Layout fixes where text overflows in English as well

**What to build:** The places the text-fit check (229) found overflowing in English, and so in Russian too, are fixed in the layout, and their entries leave `e2e/support/textFitPending.ts` marked `fixedBy: 'unassigned'`. Together with 231 this empties the pending list, which makes the check strict.

Places to fix (all from the pending list; widths are where the check sees the overflow):

1. **Dialogs wider than the phone screen (390, 360, 320 px), both languages:** Clear pattern confirmation, Change size, Keyboard shortcuts (also 320 for the key caps), Name on exports (360, 320), the QR code panel (360, 320). Likely one fix: a dialog never gets wider than the screen minus its margin, and its footer buttons wrap or stack.
2. **Export menu opens off-screen at 768 px (inside the drawer), both languages:** its items sit left of the screen. The menu must open inside the screen.
3. **Weight estimate popover in Beads needed, every width, both languages:** cut by the left column (61px in English at 1900). Overlaps with item 3 of ticket 231; whichever lands first fixes it and removes both entries.
4. **"Custom color" and "Image colors" buttons cut by an ellipsis:** 1024 and 768 (and the drawer at 768), and in the phone Colors sheet at 320, English.
5. **Tour last step, "Row done" button of the Progress bar:** pokes out of the canvas box at 1024 and 768, both languages.
6. **Smaller:** "Save Pattern" in the phone Pattern sheet at 320; the "+" stepper in Convert image framing at 320; the Overview coffee tile title "Made by one person" wraps at 320.

**Blocked by:** None (229 is done)

**Status:** done

- [x] Each place above fits at the listed widths, in English and Russian, with the design system's component specs (DESIGN.md) kept and no hardcoded colors, fonts, sizes or shadows
- [x] Every entry marked `fixedBy: 'unassigned'` is removed from `e2e/support/textFitPending.ts`; `npm run visual` passes
- [x] Looks right in the light, dark and high contrast themes, and works with the keyboard alone
- [x] Existing reference screenshots stay valid, or are updated only where the layout was meant to change
- [x] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80)

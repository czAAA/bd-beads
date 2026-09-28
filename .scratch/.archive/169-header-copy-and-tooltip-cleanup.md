# 169: Header cleanup: remove Currently-editing label, fix copy, fix theme-picker tooltip styling

**What to build:** In the app header, remove the "Currently editing" label — it adds no information the rest of the header doesn't already convey. Fix the empty-canvas hint copy to read "Make one with New Pattern, open a Saved Pattern, or import a file." (drop "on the left"). Fix the theme picker and keyboard-shortcut hover tooltips so their background color matches the import icons' tooltip background, and so the tooltip text is never clipped by an adjacent box.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] "Currently editing" label no longer renders anywhere in the header
- [ ] Empty-canvas placeholder reads "Make one with New Pattern, open a Saved Pattern, or import a file."
- [ ] Theme-picker and keyboard-shortcut tooltips use the same background token as the import-icon tooltips
- [ ] Tooltip text is fully visible, never cut off by a neighboring element, at all supported viewport widths

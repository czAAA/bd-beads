# 218: Overview carousel examples

**What to build:** Each of the carousel's seven features (ticket 217) shows its example in the stage, as the design system draws them. Parts made of beads are drawn with the real Pattern renderer so a bead looks the same as in the editor; parts that aren't Patterns (the PDF page, the Saved Patterns gallery, the mini Progress bar) are built as plain page elements in the design system's tokens.

- **Techniques:** a heart in loom, peyote and brick stitch side by side
- **Pattern editing:** a poppy with Paint active and a Selection frame
- **Convert image:** a picture beside its 6-colour beaded version
- **Row progress:** rows done faded, the current row marked, and a mini Progress bar
- **Beads needed:** the list for the Tour Pattern
- **Exports:** a PDF page with the technique word filling its width (uniform scale, never stretched)
- **Saved Patterns:** the gallery

**Blocked by:** 217 (Overview feature carousel)

**Status:** done

- [x] Every feature shows its example, in the same Technique geometry and Bead look as the editor where beads are drawn
- [x] The Overview page stays light: drawing the examples does not load the editor's code beyond what drawing needs
- [x] Examples follow the theme (light, dark, high contrast) and never stretch or overflow at any of the five screen sizes
- [x] No screenshots and no borrowed imagery; every example is decorative and `aria-hidden`, with the feature's text carrying the meaning
- [x] English and Russian copy from the design system (Writing section, "Copy added in v15"); the page still starts in English on a device with no saved language
- [x] Correct at all five screen sizes and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [x] Uses the design system tokens and type roles only (no hardcoded colors, fonts, sizes or shadows); loads no third-party fonts or scripts
- [x] Matches the Overview card and its preview in the design system
- [x] Overview and Tour question (CLAUDE.md): not applicable, this ticket completes the Overview itself

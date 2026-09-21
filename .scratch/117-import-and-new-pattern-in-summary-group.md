# 117: Import and New Pattern move into the top bar's summary group

**What to build:** The New Pattern button and both Import controls (from a Pattern file, from a QR image) move into the top bar's summary group, the aqua box that already holds the current-Pattern summary, its Bead, and the Replace Bead select. The group is laid out as clear clusters rather than a stack of loose controls: Pattern info (summary, Bead, Replace Bead) reads as one cluster, and the actions (New Pattern, Import) as another, spaced and aligned so the box looks designed, at large-display, laptop and tablet widths, and wrapping sensibly when narrow (ticket 79 covers phones).

The import result ("Imported: N", "QR imported") and error messages stay visible after an import, near the controls that caused them. New Pattern keeps its behaviour: it is disabled while there are no saved Patterns (there is already a form to fill in), and otherwise clears the open Pattern so the form appears.

This reverses ticket 51's move of New Pattern out of the top bar; ADR 0004's amendment note is updated to say so, and CONTEXT.md's App shell layout entry with it.

**Blocked by:** 116 (both tickets edit the same transfer component; QR export leaves it first)

**Status:** ready-for-agent

- [ ] New Pattern, Import from file and Import from QR image are in the top bar's summary group, and gone from the Saved Patterns and Export and import boxes
- [ ] The group is arranged in clear clusters (Pattern info, then actions) and looks tidy at large-display, laptop and iPad widths, including when a long summary or the language switcher squeezes it
- [ ] Import success and error messages still show after an import, in both languages
- [ ] Import and New Pattern behave exactly as before (including New Pattern disabled with no saved Patterns), with tests carried over
- [ ] Summary group still shows only its Pattern info when no Pattern is open, and New Pattern/Import remain available then (Import must work with an empty library)
- [ ] ADR 0004's amendment and CONTEXT.md's App shell layout entry updated

# 135: Combined design screenshots (light + dark)

**What to build:** Two final 1440×900 screenshots, one per theme of the editor page in one combined design that takes the best parts of the five prototypes in `design-exploration/choosen/` (clickhouse, hashicorp, mastercard, mistral.ai, warp). This is step 1 of 2: the user reviews the screenshots, and only once they approve does ticket 70 write `DESIGN.md` from them. No working prototype is wanted, just the images. They are rendered from a throwaway static HTML page in the gitignored `design-exploration/.src/combined/`, built with ticket 125's harness (shared sample, `screenshot.mjs`, proprietary-content rules).

**Blocked by:** 126–134 (Design exploration screenshots)

**Status:** done

## The design (all variants)

Revised after the first review round: the save box has no accent fill, the right column moved into a scrolling left column, the canvas box widened into the freed space, and Row progress moved into the Progress bar. Second round: the user chose the dark colors and the ivory light surfaces, Beads needed moved above Saved Patterns, and New Pattern and Replace bead got the accent.

- **Color scheme**: light theme uses mistral.ai's colors, except that the left-column boxes and the header's bead pill use the ivory bead color `#f5f1e8` (borders `#e8e3df`, the board color) instead of cream / white; dark theme uses clickhouse's.
- **Fonts, from warp**, including warp's type roles: Inter for controls; DM Mono in lowercase for group labels and meta text (e.g. "tools", "40×30 · Loom"); Instrument Serif italic only for the background word.
- **Header**: clickhouse's top bar and everything in it: Currently editing "Logo panel · 40×30", bead pill, Replace bead, Import a file / Import QR code, New Pattern, EN/RU, keyboard shortcuts. New Pattern and Replace bead are filled with the accent. Add a light/dark theme toggle (sun/moon) beside EN/RU; it follows the system setting (`prefers-color-scheme`) until the user picks one.
- **No Pattern title block**: remove mistral.ai's big "Logo panel" heading and its "Loom · 40 × 30 · 64 × 48 mm" line completely; the canvas box moves up into that space.
- **Canvas box and Progress bar, from mistral.ai**: the box with its header strip ("Pattern · 40 columns · 30 rows" plus zoom out / 100% / zoom in / fit), rulers, and the Progress bar along its bottom edge (a small Show row progress switch, "Row 12 of 30 · Top to bottom", progress track, Turn row direction, Row not done, Row done). **"Previous row" is renamed "Row not done".** The canvas box fills all the width right of the left column; the beads are sized to fill it.
- **Beads on the canvas**: drawn in mistral.ai's style (rounded squares), on mastercard's rounded board. Light: the light canvas box with mastercard's warm board; finished rows fade toward the board color, current row gets a dark ink outline. Dark: clickhouse's dark surface; finished rows grey, current row outlined in the accent.
- **Left column**: four separate boxes stacked (not merged into one), scrolling on its own without scrolling the canvas:
  1. **Toolbox, from mistral.ai**, minus Save, Export and Row progress: Tools (Paint, Fill, Select, Erase, Remove line, Delete all), Colors (Palette, Custom, Image colors), Edit (Undo, Redo, Rotate, Copy), then the collapsible Mirror and Size rows.
  2. **Save box, from hashicorp**, plain panel (no accent fill): "Saved · this device", Save Pattern, Export ▾ (QR · PNG · PDF).
  3. **Beads needed**, low-key: a fixed-height box with a "Beads needed · 1 200" header line in normal text (no big display number), up to 3 color rows (swatch, name, count), and a ↓ expand button.
  4. **Saved Patterns, from mastercard, but smaller**: a fixed-height box showing the 5 most recently saved Patterns as round thumbnails with name and size below (× Remove on hover), and a ↓ expand button. Expanded, it shows every Pattern plus Export Pattern / Export all; ↑ or Esc closes it.
  - Expanding grows a box downward and pushes the boxes below it down; the left column scrolls.
- **Background highlight, from mastercard**: a large faint technique word ("Loom") in Instrument Serif italic, and a soft curved line sweeping behind the bead board inside the canvas box. Low contrast in both themes, fainter in dark.

## Variants

| File | Theme |
|---|---|
| `light.png` | light (ivory surfaces), left column at rest |
| `dark.png` | dark, left column at rest |

## Review

Re-render with `node design-exploration/screenshot.mjs combined/` (variants are listed in `.src/combined/variants.json`; the page takes `?theme=light|dark`, `&expanded`, `&scrolled`). The page adds eight Saved Patterns to the shared four, so the 5-most-recent box and the expanded list differ.

The user reviews the screenshots. If they approve, that is recorded in this ticket for ticket 70. If they don't approve, ask what to change and how, re-render, and review again. Don't start ticket 70 until the user has approved.

- [x] `light.png` and `dark.png` exist in `design-exploration/combined/` at 1440×900
- [x] Every control on `design-exploration/checklist.md` is placed, except Save and Export, which move to the save box, Show row progress, which moves into the Progress bar, and Previous row, which is now "Row not done"; the only additions are the theme toggle and the expand buttons
- [x] Each item under "The design" above is visible in the screenshots (the expanded Saved Patterns box via `&expanded&scrolled`)
- [x] No proprietary content: no company or product names, brand copy, logos or imagery; fonts per `fonts.md`
- [x] The page source stays in the gitignored `design-exploration/.src/combined/`; nothing goes into `src/`
- [x] The user has approved the screenshots, and that is written into this ticket

**Approved (2026-09-26):** the user approved `light.png` (ivory light surfaces) and `dark.png` as rendered from `.src/combined/prototype.html`. Copies are committed as `docs/design/light.png` and `docs/design/dark.png`, and ticket 70 wrote `DESIGN.md` from them.

## Notes for later implementation tickets (not this one)

- "5 most recently saved" needs a last-saved order, but CONTEXT.md's Pattern library entry currently calls the library "a flat set with no ordering".
- "Row not done" replaces "Previous row" in the app, and CONTEXT.md's Progress bar entry changes with it, when the Progress bar is restyled.

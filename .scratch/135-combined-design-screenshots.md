# 135: Combined design screenshots (light + dark)

**What to build:** Five 1440×900 screenshots of the editor page in one combined design that takes the best parts of the five prototypes in `design-exploration/choosen/` (clickhouse, hashicorp, mastercard, mistral.ai, warp). This is step 1 of 2: the user reviews the screenshots, and only once they approve does ticket 70 write `DESIGN.md` from them. No working prototype is wanted, just the images. They are rendered from a throwaway static HTML page in the gitignored `design-exploration/.src/combined/`, built with ticket 125's harness (shared sample, `screenshot.mjs`, proprietary-content rules).

**Blocked by:** 126–134 (Design exploration screenshots)

**Status:** ready-for-agent

## The design (all variants)

- **Color scheme**: light theme uses mistral.ai's colors; dark theme uses clickhouse's.
- **Fonts, from warp**, including warp's type roles: Inter for controls; DM Mono in lowercase for group labels and meta text (e.g. "tools", "40×30 · Loom"); Instrument Serif italic only for the background word.
- **Header**: clickhouse's top bar and everything in it: Currently editing "Logo panel · 40×30", bead pill, Replace bead, Import a file / Import QR code, New Pattern, EN/RU, keyboard shortcuts. Add a light/dark theme toggle (sun/moon) beside EN/RU; it follows the system setting (`prefers-color-scheme`) until the user picks one.
- **No Pattern title block**: remove mistral.ai's big "Logo panel" heading and its "Loom · 40 × 30 · 64 × 48 mm" line completely; the canvas box moves up into that space.
- **Canvas box and Progress bar, from mistral.ai**: the box with its header strip ("Pattern · 40 columns · 30 rows" plus zoom out / 100% / zoom in / fit), rulers, and the Progress bar along its bottom edge ("Row 12 of 30 · Top to bottom", progress track, Turn row direction, Row done). **"Previous row" is renamed "Row not done".**
- **Beads on the canvas**: drawn in mistral.ai's style (rounded squares) in every variant.
- **Toolbox, from mistral.ai**, minus Save and Export: Tools (Paint, Fill, Select, Erase, Remove line, Delete all), Colors (Palette, Custom, Image colors), Edit (Undo, Redo, Rotate, Copy), then the collapsible Mirror, Size and Row progress rows.
- **Right column**, stacked at the top with empty space below:
  1. **Save box, from hashicorp** (its position: top of the right column): "Saved · this device", Save Pattern, Export ▾ (QR · PNG · PDF).
  2. **Beads needed**, low-key: a fixed-height box with a "Beads needed · 1 200" header line in normal text (no big display number), up to 3 color rows (swatch, name, count), and a ↓ expand button.
  3. **Saved Patterns, from mastercard, but smaller**: a fixed-height box showing the 5 most recently saved Patterns as round thumbnails with name and size below (× Remove on hover), and a ↓ expand button. Expanded, it shows every Pattern plus Export Pattern / Export all; ↑ or Esc closes it.
  - Expanding grows a box **downward within the right column's width**, into the empty space; expanding Beads needed pushes Saved Patterns down. A box that runs out of room scrolls inside itself.
- **Background highlight, from mastercard**: a large faint technique word ("Loom") in Instrument Serif italic, and a soft curved line sweeping behind the canvas. Low contrast in both themes, fainter in dark.

## Variants

| File | Theme | Save box | Canvas box |
|---|---|---|---|
| `light.png` | light | plain panel | mastercard's light warm board; finished rows fade toward the board color, current row gets a dark ink outline |
| `light-accent.png` | light | filled with the light accent (mistral.ai orange), dark text | dark (mistral.ai black); finished rows grey, current row outlined in the accent |
| `dark.png` | dark | plain panel | dark (clickhouse surface); finished rows grey, current row outlined in the accent |
| `dark-accent.png` | dark | filled with the dark accent (clickhouse neon yellow), black text | as `dark.png` |
| `light-expanded.png` | light | as `light.png` | as `light.png`, with Saved Patterns expanded to show all Patterns |

## Review

The user reviews the screenshots. If they approve, they pick one variant per theme (with or without accent; the two themes can differ), and that choice is recorded in this ticket for ticket 70. If they don't approve, ask what to change and how, re-render, and review again. Don't start ticket 70 until the user has approved.

- [ ] `light.png`, `light-accent.png`, `dark.png`, `dark-accent.png` and `light-expanded.png` exist in `design-exploration/combined/` at 1440×900
- [ ] Every control on `design-exploration/checklist.md` is placed, except Save and Export, which move to the save box, and Previous row, which is now "Row not done"; the only additions are the theme toggle and the expand buttons
- [ ] Each item under "The design" above is visible in the screenshots, with the per-variant differences from the table
- [ ] No proprietary content: no company or product names, brand copy, logos or imagery; fonts per `fonts.md`
- [ ] The page source stays in the gitignored `design-exploration/.src/combined/`; nothing goes into `src/`
- [ ] The user has approved the screenshots, and their pick (one variant per theme) is written into this ticket

## Notes for later implementation tickets (not this one)

- "5 most recently saved" needs a last-saved order, but CONTEXT.md's Pattern library entry currently calls the library "a flat set with no ordering".
- "Row not done" replaces "Previous row" in the app, and CONTEXT.md's Progress bar entry changes with it, when the Progress bar is restyled.

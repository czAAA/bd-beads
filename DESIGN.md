# DESIGN.md: bd-beads visual language

The entry point to how bd-beads looks and behaves. The design itself lives in the **bd-beads design system,
version 18 as its baseline**, owned by this repo in [`docs/design/system/`](docs/design/system/README.md) ([ADR 0030](docs/adr/0030-the-repo-owns-the-design-system.md)). This file doesn't repeat its token values or component specs. It says which source wins, where each topic lives, and the app-specific notes the design system doesn't carry. Every UI change follows it ([ADR 0021](docs/adr/0021-visual-language-follows-design-md.md)).

**Before building or changing UI:** read the design system's [README](docs/design/system/README.md), then the card
for each component you touch (`docs/design/system/components/<Name>/README.md`), then the
guideline file for the topic (§3). Use tokens; never type a color, size, duration or z-index by hand.

---

## 1. Principles

- **An editor, not a page.** The Pattern is the largest thing on screen. Everything else is compact chrome around it.
- **One accent per theme.** It marks the single most likely next action in a region, the active tool and the current
  row. Nothing else is accent-colored.
- **Flat, with hairlines.** Light uses hairlines and a few soft shadows; dark uses surface steps; high contrast uses
  borders.
- **Strict type roles.** Inter for anything you read or press; DM Mono, lowercase, for labels and meta; Instrument
  Serif italic only for the technique word (behind the canvas and on exports) and the maker's name on exports.
- **Nothing borrowed.** No company or product names, logos or imagery.

The design system's [README](docs/design/system/README.md) states these in full.

---

## 2. Which source wins

| For | The source is | This file |
|---|---|---|
| Tokens (color in three themes, type, spacing, radii, elevation, layout and touch target, z-index, print) | `docs/design/system/tokens.json` (and its CSS form, `tokens.css`) | points at it |
| Values that can't be tokens: motion (`--duration-*`, `--ease-*`), `--hover-fill`, `--press-fill`, `--track-fill`, scrims | the top of `docs/design/system/components/bundle.css` and each theme block in it | points at it |
| Component specs, states, layout, responsive tiers | the design system's guideline docs and component cards | points at them |
| Copy: voice, glossary, numbers and units, the Russian strings | `docs/design/system/writing.md` | points at it |
| Artwork: logo, favicon, icons | the SVG and PNG files in `docs/design/system/assets/` and `favicon/` | points at them |
| How the app wires the design in (§4) | this file | **wins** |

- **The design system wins** for tokens, specs, copy and artwork. Don't copy a value from it into this file or into
  a ticket; link to it.
- **This file wins only for its app-specific notes** (§4): the canvas renderer's `ProjectTheme`, exports always drawn
  in light, the bundled fonts, the ADR links.
- **A need neither covers**, or a deliberate difference between the app and a card, is added to the design system in
  place (§6), in the same commit as the code. Don't invent it in a component only.
- The component cards are written descriptions, not runnable code. The Vue components in `src/components/` stay the
  implementation.

---

## 3. Where each topic lives

All paths are under [`docs/design/system/`](docs/design/system/README.md).

| Topic | File |
|---|---|
| Principles, content, color and type rules, logo, favicon, iconography | [`README.md`](docs/design/system/README.md) |
| Tokens as data: color (light, dark, contrast), type, spacing, radius, shadow, layout, zIndex, print | [`tokens.json`](docs/design/system/tokens.json) |
| The same tokens as CSS custom properties and type classes | [`tokens.css`](docs/design/system/tokens.css) |
| Values that aren't plain tokens (motion, `--hover-fill`, `--press-fill`, `--track-fill`, scrims) and the card styles | [`components/bundle.css`](docs/design/system/components/bundle.css) |
| Tiers (phone, iPad 13″, MacBook Air, 24″+), fitting longer text, input, screen edges | [`responsive.md`](docs/design/system/responsive.md) |
| Form controls, empty, loading, errors and results | [`forms-and-states.md`](docs/design/system/forms-and-states.md) |
| Hover, pressed, focus, disabled states; motion tokens | [`interaction-and-motion.md`](docs/design/system/interaction-and-motion.md) |
| Contrast, high contrast, never color alone, text and zoom, keyboard, painting with the keyboard, screen readers, stacking order | [`accessibility.md`](docs/design/system/accessibility.md) |
| PDF and PNG exports: page 1, chart pages, beads and grams, the maker's name, wide and long Patterns | [`printed-output.md`](docs/design/system/printed-output.md) |
| Voice, sentence patterns, plurals, glossary, color names, numbers and units, strings to fix, Russian | [`writing.md`](docs/design/system/writing.md) |
| One card per component (67, plus the `Cover`): a short written guideline | [`components/<Name>/`](docs/design/system/components) |
| Logo and app icons | [`assets/Logos/`](docs/design/system/assets/Logos) |
| The theme-aware favicon set for `public/` | [`favicon/`](docs/design/system/favicon) |
| Icons v2 (53 in the repo: the legacy `row-progress` icon is left out, since the app drops the Row progress group) | [`assets/Icons/`](docs/design/system/assets/Icons) |
| Icons v1, the icons the app shipped before v2 (reference only) | [`assets/Icons v1/`](docs/design/system/assets/Icons%20v1) |

### 3.1 Old section numbers

Tickets written before the v13 rewrite cite `DESIGN.md §N`. They now resolve here:

| Old § | Topic | Now |
|---|---|---|
| §1 | Principles | §1 above; design system README, Principles |
| §2 | Themes | README, Themes; `ThemeToggle`, `HighContrastTheme` cards; §4.1 below |
| §3, §3.1 | Color tokens | `tokens.json` → `color` |
| §3.2 | Typography, font stacks | `tokens.json` → `type`; README, Type; §4.3 below for bundling |
| §3.3 | Spacing | `tokens.json` → `spacing`, `layout` |
| §3.4 | Radii | `tokens.json` → `radius` |
| §3.5 | Elevation | `tokens.json` → `shadow`; `accessibility.md`, Stacking order |
| §3.6 | Contrast | `accessibility.md`, Contrast; `ContrastAudit` card |
| §4 | Layout | README, Layout; `responsive.md`; `ScreenSizes` card |
| §4.1 | Header | `Header`, `BeadPill`, `OverflowMenu` cards |
| §4.2 | Left column | `Toolbox`, `SaveBox`, `BeadsNeeded`, `SavedPatterns` cards |
| §4.3 | Canvas box | `CanvasStrip`, `ZoomPill`, `BeadBoard`, `ProgressBar` cards |
| §4.4 | Background highlight | `BeadBoard` card; `word` and `curve` tokens |
| §5 | Components | the component cards |
| §5.1 | Buttons and selects | `Button`, `InteractionStates` cards; `interaction-and-motion.md` |
| §5.2 | Bead pill, language switcher | `BeadPill`, `Header` cards |
| §5.3 | Theme toggle | `ThemeToggle` card |
| §5.4 | Tool tabs | `ToolTabs` card |
| §5.5 | Palette swatches | `PaletteSwatches`, `ColorPickers` cards |
| §5.6 | Disclosure row | `DisclosureRow`, `MirrorSizeControls` cards |
| §5.7 | Tool group | `Toolbox` card |
| §5.8 | Expandable panel | `BeadsNeeded`, `SavedPatternsExpanded` cards |
| §5.9 | Saved Pattern thumbnail | `SavedPatterns` card |
| §5.10 | Save box | `SaveBox`, `SaveStates`, `Menu`, `NameOnExports` cards |
| §5.11 | Progress bar | `ProgressBar`, `SwitchAndFileButton` cards |
| §5.12 | Message | `Message`, `ImportResult` cards; `forms-and-states.md` |
| §5.13 | Modal, menu, tooltip | `Modal`, `ConfirmDialogs`, `Menu`, `QrExport`, `ShortcutsHelp` cards |
| §6.1 | Icons | README, Iconography; `assets/Icons/` |
| §6.2 | Logo | README, Logo; `assets/Logos/` |
| §6.3 | Favicon | README, Favicon; `favicon/` |
| §7 | Bead drawing | `BeadBoard`, `BeadHover`, `BeadCursor` cards; §4.2 below |
| §8 | Copy | `writing.md` |
| §9 | What changes | §5 below |
| §10 | Design system files | §3 and §6 below |

---

## 4. App-specific notes

What the design system doesn't carry, because it's about how this codebase uses it.

### 4.1 Themes in the app

- Three themes: `light`, `dark` and `contrast` (high contrast), written as `data-theme` on `<html>` with the
  matching `color-scheme`, before first paint, by a small inline script in `index.html`, so there is no flash of the
  wrong theme.
- With no pick, the theme follows the device, live: `prefers-color-scheme`, and `prefers-contrast: more` for high
  contrast. The header's four-way theme control (Match device, Light, Dark, High contrast) sets a pick, remembered on
  this device like the language (ticket 139).
- `lang` on `<html>` follows the app language.

### 4.2 The canvas renderer's `ProjectTheme`

The Project renderer ([ADR 0018](docs/adr/0018-pattern-drawn-by-one-renderer-not-a-dom-cell-per-bead.md)) draws in a
canvas, an export and a test, none of which can read CSS. So it takes its colors from a `ProjectTheme` object
(`src/rendering/beadLook.ts`), one per theme, whose values are copied from the tokens:

| `ProjectTheme` field | Token |
|---|---|
| `background` | `board` (on screen) / `print-board` (PDF and PNG) |
| `rim` | `bead-rim` |
| `emptyBead` | `bead-empty` |
| `seam` | `bead-seam` |
| `marker` | `marker` |
| `outline` | `bead-outline` |
| `tourMark` | `tour-highlight` (the Tour's dashed marks on beads to paint and frames to select or paste into, drawn over a `bead-outline` underlay so they read on a gold bead too) |

Ticket 140 adds a test that keeps each theme's `ProjectTheme` equal to `tokens.json`, so a token refresh can't leave
the canvas behind.
The board, bead shape, finished rows and current row are drawn as the `BeadBoard` card describes.

On screen the drawing area's `canvas` (and `background`) is the person's Canvas color (`src/rendering/canvasBackgrounds.ts`, ticket 252), not always `box`. Its eleven colors are the `canvas-bg-1` to `canvas-bg-6` tokens (light, dark; ticket 284), copied into that file, and `canvasBackgrounds.test.ts` keeps the copy equal to `tokens.json`. Only Ash (dark choice 6) carries its own greys there, as the CanvasBackground card says.

### 4.3 Exports are always light

PNG and PDF exports use the light `ProjectTheme` with `print-board`, whichever theme the user works in, so a printed
chart looks the same everywhere. Their layout is `printed-output.md` and the `print-*` tokens.

Exports are drawn on a canvas, which does not wait for web fonts: the export code awaits `document.fonts.load()` for
every face it uses (Inter 400/500/600/700, DM Mono 400, Instrument Serif italic, and the two Cyrillic fallbacks)
before the first page is drawn, or the text falls back to a system font.

### 4.4 Fonts are bundled

Inter (400/500/600/700; 600 is the `title` style and the export facts), DM Mono (400) and Instrument Serif (italic 400), plus JetBrains Mono and Source Serif 4 for the
Cyrillic glyphs DM Mono and Instrument Serif lack, ship with the app as same-origin `woff2` files under
`public/fonts/`. They are never loaded from a font CDN: the app works offline and makes no third-party requests
([ADR 0001](docs/adr/0001-local-only-persistence.md)). All five are SIL Open Font License. The design system's
the design system no longer has preview pages (ticket 297).

### 4.5 Icons and logo in the UI

The SVG files carry a fixed `#1f1f1f` stroke because an `<img>` can't inherit color. The app inlines them and sets
`stroke: currentColor` (the logo mark: `stroke: var(--accent)`). Take the files from the design system; don't redraw
them. Every icon in the UI goes through `AppIcon`; no inline `<svg>`. `more` is reserved: no card places it, so the app
doesn't draw it. The QR code's black modules on white (`QrCode.vue`) are deliberate: a scanner needs that contrast in
every theme.

### 4.6 Tokens in the app's CSS

- The app imports `docs/design/system/tokens.css` (the three theme blocks, the other families and the type classes)
  once, at the root of its styles. Components use `var(--token)` and the type classes only.
- The values that aren't tokens (motion, `--hover-fill`, `--press-fill`, `--track-fill`, scrims, and their dark and
  contrast overrides) are copied from the top of `components/bundle.css` into one app file, `src/styles/design-values.css`.
- The app never imports `components/bundle.css` itself: the rest of it styles the retired preview cards
  (`bb-*`, `ix-*`, `e-*`, `bc-*` classes, ticket 297), not the app.
- Media queries can't read custom properties, so the breakpoints are written as literal values that match the `bp-*`
  tokens (`@media (min-width: 744px)`).
- The design system's `--text-*` tokens and classes are the app's `--type-*`: the same styles under another name. The app
  keeps its names; renaming them would only churn.
- Local stacking is deliberate: the size-estimate tooltip in the Frame rail uses `--z-canvas-overlay` (10) for the same
  "above its neighbours, inside its box" job.
- Card sizes that aren't tokens (the Export prompt's 288px and 10px radius, `--popover-width` and `--popover-radius`)
  live in `src/styles/controls.css`.

### 4.7 Decisions

- [ADR 0021](docs/adr/0021-visual-language-follows-design-md.md): the visual language follows this file and the
  design system; amends [0004](docs/adr/0004-three-panel-app-shell.md) and [0005](docs/adr/0005-tools-above-canvas.md).
- [ADR 0001](docs/adr/0001-local-only-persistence.md): no third-party requests (bundled fonts).
- [ADR 0012](docs/adr/0012-saving-follows-the-pattern-library.md): the save box reports the Pattern library's save state.
- [ADR 0017](docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md): measured sizes are estimates.
- [ADR 0018](docs/adr/0018-pattern-drawn-by-one-renderer-not-a-dom-cell-per-bead.md): one renderer draws the Project.

---

## 5. What changes from today's app

A map for the implementation tickets (136–168, and 75–83).

| Area | Today | Design system v14 | Ticket |
|---|---|---|---|
| Tokens | ticket 02's palette (`--color-ink #1d3658`, 3px outlines, Segoe UI) | role-named tokens, three themes | 136 |
| Themes | light only | light, dark, high contrast; four-way control, device default | 136, 139, 160 |
| Fonts | system UI | Inter, DM Mono, Instrument Serif, bundled | 136 |
| Icons | Icons v1, 23 icons inline in components | Icons v2 with the bead signature, one `Icon` component | 137 |
| Logo, favicon | a QR-style bead grid favicon, a generic bead glyph | the X1 mark, theme-aware favicon with `.ico`, PNG and Apple touch fallbacks | 138 |
| Bead drawing | white background, paper rim, grey dimmed rows | the board, per-theme `ProjectTheme`, light rows fade toward the board | 140 |
| Layout | Toolbox rail or New Pattern form on the left; panels below the canvas; the page scrolls | one 366px left column of four boxes scrolling on its own; the canvas box fills the rest | 141 |
| Header | ticket 02 header | brand, currently editing, Bead pill, Replace bead, imports, New Pattern, EN / RU, theme, shortcuts | 142 |
| Canvas box | zoom cluster in the panel's corner | strip with zoom, board, background word and curve | 143 |
| Row progress | toggles in the Toolbox; bar placed by Pattern shape, hidden while off | one Progress bar along the canvas box's bottom, always shown | 144 |
| Saved Patterns | a list of every Pattern | 5 most recently saved as round thumbnails, expandable; needs a last-saved order | 145, 147 |
| Beads needed | a list with a total | expandable panel, total in the title, a grams column (needs beads per gram in the catalog) | 146, and the grams feature ticket |
| Save and export | in the Toolbox's Edit group | a save box with Export ▾ menu | 148 |
| New Pattern form, Convert image | ticket 02 look | restyled Toolbox-like panel | 149, 150 |
| Panels and pickers, messages, modals | ticket 02 look | Modal, Menu, Message cards | 151, 76 |
| Toolbox | groups with a 4-per-row grid | tool tabs, swatches, Edit row, Mirror and Size disclosure rows | 75 |
| States, a11y | partial | interaction states, empty/loading/error, keyboard painting, screen readers, forced colors | 157–160 |
| Exports | today's PDF and PNG | page 1, chart pages, wide and long Patterns, name on exports | 161–164 |
| Copy | today's strings | `writing.md` audit | 165 |
| Responsive | desktop only | five tiers, touch input | 79, 83, 166–168 |

---

## 6. Changing the design system

The repo owns the design system ([ADR 0030](docs/adr/0030-the-repo-owns-the-design-system.md)). v18, copied from
claude.ai on 2026-10-04, is the baseline. The repo is the source: nothing is synced from claude.ai into it, and a change is
copied back out to the claude.ai project only when that copy needs it.

When a change touches how something looks, reads or behaves, edit `docs/design/system/` in the same commit as the code:

1. The component's card: `README.md`. A new component gets a new card folder.
2. Tokens: `tokens.json` and `tokens.css` together (the `tokens` test compares them). A new token needs a role name and
   a `usage` line, in all three themes where it differs.
3. Values that can't be tokens: the top of `components/bundle.css`, and `src/styles/design-values.css` to match
   (§4.6).
4. Guideline files (`accessibility.md`, `responsive.md`, `interaction-and-motion.md`, `forms-and-states.md`,
   `printed-output.md`, `writing.md`) when a rule changes, and `writing.md` for any new or changed copy.
5. A line in the Version section of `docs/design/system/README.md`: "Repo, YYYY-MM-DD, ticket N: what changed".
6. The `ProjectTheme` check (§4.2) fails if a canvas token changed without the renderer; run the tests related to the
   change.

If the app deliberately differs from a card, fix the card to say what the app does (and why, in one line), not the
other way round.

**Version in the repo:** design system **v18** is the baseline. Changes since are in the Version section of
[`docs/design/system/README.md`](docs/design/system/README.md). v17 is vocabulary only (Project and Pattern); v18 adds
the Frame margin and the icon-tile Toolbox.
The `CanvasStrip` card still carries the "pieces outside the Frame" count (§4.2).

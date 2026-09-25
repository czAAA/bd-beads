# DESIGN.md — bd-beads visual language

The single reference for how bd-beads looks: tokens, layout and component templates for the light and the dark
theme. Every UI change follows it (see [ADR 0021](docs/adr/0021-visual-language-follows-design-md.md)); a need it
doesn't cover is added here first, then built.

It documents the design approved in ticket 135. The two approved screenshots, `docs/design/light.png` and
`docs/design/dark.png` (1440 × 900), show it; where this file and a screenshot disagree, this file wins. Anything the
screenshots don't show (messages, modals, hover and focus states, the empty Row progress state) is marked
**Derived**: worked out from the same tokens, not approved pixel by pixel.

---

## 1. Principles

- **An editor, not a page.** The Pattern is the largest thing on screen. Everything else is compact chrome around it.
- **One accent per theme.** Orange `#fa520f` in light, neon yellow `#faff69` in dark. It marks the single most likely
  next action in a region (New Pattern, Replace bead, Save Pattern, Row done), the active tool and the current row.
  Nothing else is accent-colored.
- **Flat, with hairlines.** Light separates surfaces with 1px hairlines and a few soft shadows. Dark uses no shadows:
  depth comes from four surface steps (§3.1).
- **Strict type roles.** Inter for anything you read or press; DM Mono, lowercase, for labels and meta; Instrument
  Serif italic only for the background word (§3.2).
- **Nothing borrowed.** No company or product names, logos or imagery. Colors, fonts and copy are the app's own.

---

## 2. Themes

Two themes, **light** and **dark**, with identical layout and components; only the tokens change.

- **Default:** follows the device (`prefers-color-scheme`), live, so switching the device's setting switches the app.
- **The user's pick:** the sun/moon toggle in the header (§5.3) sets light or dark. From then on the app ignores the
  device's setting. The pick is remembered on this device, like the language.
- **Implementation:** the resolved theme is written as `data-theme="light|dark"` on `<html>` before first paint (a
  small inline script in `index.html`, so there is no flash of the wrong theme), and every token is defined under
  `:root[data-theme=light]` / `:root[data-theme=dark]`. Set `color-scheme: light|dark` with it, so native controls and
  scrollbars follow.
- **Canvas drawing:** the Pattern renderer, PNG/PDF export and the Convert image preview take their colors from a
  per-theme `PatternTheme` (§7), not from CSS. **Exports always use the light theme**, so a printed chart looks the
  same whichever theme the user works in. (Derived.)

---

## 3. Tokens

CSS custom properties with role names. Hex values are exact.

### 3.1 Color

**Page and surfaces**

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--canvas` | `#ffffff` | `#0a0a0a` | Page background, header |
| `--surface` | `#fafafa` | `#121212` | Quiet fills (hover on a text button, table stripes) |
| `--panel` | `#f5f1e8` | `#1a1a1a` | The four left-column boxes (§4.2) |
| `--panel-line` | `#e8e3df` | `#1a1a1a` | Left-column box borders (invisible in dark) |
| `--panel-rule` | `#e8e3df` | `#2a2a2a` | Dividers inside a box (Mirror / Size rows) |
| `--elevated` | `#ffffff` | `#242424` | Buttons and thumbnails *inside* a box; modal surface in dark |
| `--pill` | `#f5f1e8` | `#1a1a1a` | The Bead pill in the header |

**Text**

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--ink` | `#1f1f1f` | `#ffffff` | Primary text and icons |
| `--body` | `#4a4a4a` | `#cccccc` | Secondary text (Beads needed color names) |
| `--muted` | `#6a6a6a` | `#888888` | Labels and meta (DM Mono), inactive tab labels, chevrons |
| `--subtle` | `#8a8a8a` | `#888888` | "/ RU", the inactive theme icon |
| `--faint` | `#a8a8a8` | `#5a5a5a` | Disabled text and icons (Image colors while empty) |

**Lines**

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--line` | `#e5e5e5` | `#2a2a2a` | Hairlines |
| `--line-soft` | `#ededed` | `#2a2a2a` | Header bottom border; row dividers inside boxes |
| `--line-strong` | `#c7c7c7` | `#3a3a3a` | Button and select borders on the page, expand buttons, the Tools tab rule |

**Accent and status**

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--accent` | `#fa520f` | `#faff69` | See §1. Also the brand mark, the active tool, the selected Saved Pattern |
| `--accent-hover` | `#cc3a05` | `#e6eb52` | Primary button hover/pressed (Derived from each source's own pressed shade) |
| `--accent-disabled-bg` / `-fg` | `#e5e5e5` / `#a8a8a8` | `#3a3a1f` / `#888888` | Disabled primary button |
| `--on-accent` | `#ffffff` | `#0a0a0a` | Text and icons on accent |
| `--ring` | `#1f1f1f` | `#faff69` | The selected palette swatch's ring |
| `--danger` | `#cc3a05` | `#ef4444` | Delete all, error text and error message edge |
| `--warning` | `#ffa110` | `#f59e0b` | Warning message edge, the Estimated size warning (Derived) |
| `--swatch-edge` | `rgba(0,0,0,.2)` | `#3a3a3a` | Inset 1px edge on every swatch, so ivory and black swatches don't vanish |

**Buttons on the page** (header)

| Token | Light | Dark |
|---|---|---|
| `--button` | `#ffffff` | `#1a1a1a` |
| `--button-line` | `#c7c7c7` | `#1a1a1a` |

**Canvas box** (§4.3)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--box` | `#fafafa` | `#1a1a1a` | Canvas box background |
| `--box-line` | `#e5e5e5` | `#1a1a1a` | Canvas box border |
| `--box-muted` | `#6a6a6a` | `#888888` | Meta text in the header strip and Progress bar; strip dividers are this at 22% |
| `--box-button` / `--box-button-line` | transparent / `#c7c7c7` | `#242424` / `#242424` | Buttons in the Progress bar |
| `--board` | `#e8e3df` | `#1a1a1a` | The rounded board the beads sit on |
| `--ruler` | `#8a8a8a` | `#5a5a5a` | Row and column numbers |
| `--marker` | `#1f1f1f` | `#faff69` | Current-row outline and its ruler number |
| `--track` | `#e5e5e5` | `#2a2a2a` | Progress bar track |
| `--track-fill` | `linear-gradient(90deg, #fa520f, #ffa110)` | `#faff69` | Progress bar fill |

**Background highlight** (§4.4)

| Token | Light | Dark |
|---|---|---|
| `--word` | `#f1eadd` | `#202020` |
| `--curve` | `rgba(250,82,15,.32)` | `rgba(250,255,105,.14)` |

### 3.2 Typography

| Role | Font | Size / line | Weight | Extra | Used for |
|---|---|---|---|---|---|
| brand | Inter | 18 / 1 | 700 | tracking −0.3px | "bd-beads" |
| control | Inter | 14 / 20 | 500 | | Buttons, selects, row labels (Mirror, Size), box titles, "Row 12", "Pattern" |
| body | Inter | 14 / 20 | 400 | | Text, Beads needed rows |
| tab | Inter | 13 / 18 | 500 | | Tool tab labels under their icons; small buttons (Custom, Image colors) |
| pill | Inter | 13 / 18 | 500 | | Bead pill |
| small | Inter | 12 / 15 | 500 | | Saved Pattern names under thumbnails |
| label | DM Mono | 13 / 18 | 400 | lowercase | Group labels ("tools", "colors", "edit"), "currently editing", "saved · this device" |
| meta | DM Mono | 13 / 18 | 400 | lowercase | Values next to a label: "l–r 1 · t–b 0", "64×48 mm", "40 columns · 30 rows", "of 30 · top to bottom", counts, "100%" |
| meta-small | DM Mono | 12 / 16 | 400 | lowercase | "qr · png · pdf", "5 of 12" |
| meta-tiny | DM Mono | 11 / 15 | 400 | | Saved Pattern sizes ("40×30"), `kbd` hints ("esc") |
| ruler | DM Mono | 11 | 400; current row 700 | | Canvas rulers |
| word | Instrument Serif | 240 / 1 | 400 italic | tracking −4px | The background word only |

- **Lowercase** is `text-transform: lowercase` on the role, not lowercase strings. The i18n copy stays in sentence
  case, so the same string also works outside a label.
- **Numbers:** thousands are grouped with a no-break space: "1 200".
- **Font stacks** (Cyrillic: DM Mono and Instrument Serif have none, so the Russian UI falls back per glyph):
  - `--font-sans: 'Inter', system-ui, sans-serif`
  - `--font-mono: 'DM Mono', 'JetBrains Mono', ui-monospace, monospace` (JetBrains Mono's Cyrillic subset only)
  - `--font-serif: 'Instrument Serif', 'Source Serif 4', Georgia, serif` (Source Serif 4 italic, Cyrillic subset only)
- **Bundle the fonts** with the app as `woff2` files (Inter 400/500/700, DM Mono 400, Instrument Serif italic 400,
  plus the two Cyrillic fallbacks). Don't load them from a font CDN at runtime: the app works offline and makes no
  third-party requests ([ADR 0001](docs/adr/0001-local-only-persistence.md)). All five are free fonts (SIL Open Font License).

### 3.3 Spacing

A 4px base, with 2px and 6px steps for tight control groups.

`2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32`

| Where | Value |
|---|---|
| Page padding (main area) | 24 top/bottom, 32 left/right |
| Header padding / gap | 0 32 / 10 |
| Gap between left-column boxes | 16 |
| Gap from left column to canvas box | 14, plus a 14 scrollbar gutter inside the column (28 visible) |
| Toolbox padding / gap between its groups | 24 / 20 |
| Save box padding | 16 20 |
| Beads needed / Saved Patterns padding | 14 20 16 |
| Label to its content | 8 (group labels), 10 (save box label) |
| Buttons in a row | 8 apart; 6 in the Edit row and swatch grid |

### 3.4 Radii

| Token | Value | Used for |
|---|---|---|
| `--radius-xs` | 4px | `kbd` hints |
| `--radius-sm` | 6px | Swatches, zoom buttons, theme-toggle buttons |
| `--radius-md` | 8px | Buttons, selects, the theme toggle's frame |
| `--radius-lg` | 12px | Every box, the canvas box, modals |
| `--radius-board` | 32px | The bead board |
| `--radius-full` | 9999px | Pills, the switch, round icon buttons, thumbnails, the progress track |
| bead corner | 22% of the bead's width | Rounded beads (§7) |

### 3.5 Elevation

| Level | Light | Dark | Used for |
|---|---|---|---|
| 0 flat | no shadow, 1px border | no shadow, surface step | Toolbox, header, buttons |
| 1 card | `rgba(0,0,0,.04) 0 4px 12px` | none | Save box, Beads needed, Saved Patterns |
| 2 canvas | `rgba(0,0,0,.08) 0 12px 24px -4px` | none | Canvas box |
| 3 overlay | `rgba(0,0,0,.12) 0 16px 48px -8px` | none; 1px `--line-strong` border | Modals, menus, messages (Derived) |

Dark surface steps, darkest first: `--canvas #0a0a0a` → `--surface #121212` → `--panel #1a1a1a` → `--elevated #242424`.

---

## 4. Layout

Reference viewport 1440 × 900. Phone, tablet and large displays are tickets 79 and 83. They adapt this layout and
must not invent new chrome.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◎ bd-beads  currently editing  Logo panel · 40×30  (bead pill) [Replace bead▾]             │ 64px header
│             … Import a file  Import QR code  [+ New Pattern]  EN / RU  [☀|☾]  (⌨)            │
├────────────────────────┬─────────────────────────────────────────────────────────────────┤
│ ┌ Toolbox ───────────┐ │ ┌ canvas box ─────────────────────────────────────────────────┐ │
│ │ tools / colors /   │ │ │ ▦ Pattern  40 columns · 30 rows            ⊖ 100% ⊕ ⛶      │ │ 46px strip
│ │ edit / Mirror ▾ /  │ │ │                                                             │ │
│ │ Size ▾             │ │ │          rulers + bead board (fills the box)                │ │
│ └────────────────────┘ │ │                       "Loom" word, curve behind             │ │
│ ┌ save box ──────────┐ │ │                                                             │ │
│ └────────────────────┘ │ ├─────────────────────────────────────────────────────────────┤ │
│ ┌ Beads needed ──────┐ │ │ (●) Row 12 of 30 · top to bottom ━━━━──── ⇄ [‹ Row not done] [✓ Row done] │ 56px
│ └────────────────────┘ │ └─────────────────────────────────────────────────────────────┘ │
│ ┌ Saved Patterns ────┐ │                                                                 │
│   (column scrolls on its own)                                                              │
└────────────────────────┴─────────────────────────────────────────────────────────────────┘
      326px column                         canvas box: all remaining width
```

The page itself never scrolls. The left column scrolls on its own, and the Pattern scrolls inside the canvas box. So
the header, the Toolbox's top and the Progress bar stay in view on a Pattern of any size.

### 4.1 Header

64px tall on `--canvas`, 1px `--line-soft` bottom border, items 10px apart, none shrinking. In order:

1. **Brand:** the bead glyph (22px, `--accent`) and "bd-beads" (brand), 10px extra space after.
2. **"currently editing"** (label), then the Pattern summary "Logo panel · 40×30" (control), then the **Bead pill**
   (pill on `--pill`, radius full, padding 4 12). Only while a Pattern is open.
3. **Replace bead:** a select, filled with the accent (§5.1 primary select).
4. A flexible gap.
5. **Import a file**, **Import QR code:** text buttons with icons. Their results and errors show beside them.
6. **New Pattern:** primary button with a plus icon.
7. **EN / RU:** one secondary button; the current language in `--ink`, "/ RU" in `--subtle`.
8. **Theme toggle** (§5.3).
9. **Keyboard shortcuts:** round icon button, 34px.

Library-wide notices (the "couldn't save" notice) keep their own row directly under the header, full width, using the
message template (§5.12). The row only takes space while there is something to say.

### 4.2 Left column

326px wide: 312px boxes plus a 14px gutter for a thin scrollbar (`scrollbar-width: thin; scrollbar-color:
var(--line-strong) transparent`). It scrolls on its own (`overflow-y: auto`) and never scrolls the canvas. There are
four separate boxes, 16px apart, always in this order:

1. **Toolbox** (§5.7): `--panel`, 1px `--panel-line`, radius 12, padding 24, no shadow. Tool groups: **Tools**,
   **Colors**, **Edit**, then the **Mirror** and **Size** disclosure rows.
2. **Save box** (§5.10): elevation 1.
3. **Beads needed** (§5.8): expandable panel, elevation 1.
4. **Saved Patterns** (§5.9): expandable panel, elevation 1.

With no Pattern open, or during a Convert image framing step, the **New Pattern form** takes the Toolbox's place as
the first box, styled as a Toolbox-like panel (Derived). The other three boxes stay.

### 4.3 Canvas box

Takes all the width right of the left column and the full height of the main area. `--box`, 1px `--box-line`,
radius 12, elevation 2 (light only), `overflow: hidden`. Three stacked parts:

1. **Header strip**, 46px, padding 0 10 0 16, gap 12, bottom divider `--box-muted` at 22%: grid icon + "Pattern"
   (control), "40 columns · 30 rows" (meta), then zoom right-aligned: zoom out, "100%" (DM Mono 13, 48px wide,
   centered), zoom in, reset zoom to fit. Icon buttons are 30px, radius 6, with no fill.
2. **Drawing area**, which takes the rest. It holds the rulers and the bead board (§7), centered, and the background
   highlight behind them (§4.4). At "fit" the beads are sized so the board fills the area, with about 36px spare
   left/right and 18px top/bottom. Zoom scales from there.
3. **Progress bar** (§5.11), 56px, along the bottom edge, top divider as the strip. **It is always there**, whatever
   the Pattern's shape, because its first control is the switch that turns Row progress on.

### 4.4 Background highlight

Inside the drawing area, behind the board (`position: absolute`, drawn before the grid, `pointer-events: none`):

- **The technique word:** the open Pattern's Technique ("Loom"), word role (240px Instrument Serif italic,
  −4px), `--word`, anchored bottom-right (right −8px, bottom −40px), and partly covered by the board.
- **A curve:** one 1.5px `--curve` stroke sweeping from the lower left up to the upper right (SVG
  `M-20 640 C 200 740, 380 420, 560 380 S 860 520, 1020 60` in a 1000 × 700 box, stretched to the area).

Both are decoration only: `aria-hidden`, never interactive, never in exports.

---

## 5. Components

Sizes are the default (34px controls) unless stated. Every interactive element gets a visible focus ring:
`outline: 2px solid var(--accent); outline-offset: 2px` (Derived).

### 5.1 Buttons and selects

| Variant | Fill / border / text | Radius | Notes |
|---|---|---|---|
| **primary** | `--accent` / `--accent` / `--on-accent` | 8 | Hover/pressed `--accent-hover` fill and border; disabled uses `--accent-disabled-*` |
| **primary select** | as primary | 8 | Replace bead. Label weight 500; the native chevron takes `--on-accent` |
| **secondary** | `--button` / `--button-line` / `--ink` | 8 | On the page (header). Hover: `--surface` fill in light, `--elevated` in dark |
| **secondary in a box** | `--elevated` / `--line-strong` (light), `--elevated` (dark) / `--ink` | 8 | Inside the save box and Saved Patterns; the Toolbox's own buttons use `--panel-line` as border |
| **text** | none / none / `--ink` | 8 | Import a file, Import QR code; padding 0 6; hover `--surface` |
| **link** | none | – | Remove line (`--ink`), Delete all (`--danger`); 14/20 500, icon 16, gap 6 |
| **icon** | as secondary, 34 × 34 | 8 | Turn row direction |
| **round icon** | as secondary, 34 × 34 | full | Keyboard shortcuts |
| **expand** | none / 1px `--line-strong` / `--ink` | full | 28 × 28, arrow icon 14 (§5.8) |

Content: icon (15px, stroke 1.75) then label, 8px apart, padding 0 12, label weight 500. Two primary buttons never sit
next to each other.

### 5.2 Bead pill and language switcher

- **Bead pill:** read-only, `--pill`, pill role, radius full, padding 4 12.
- **EN / RU:** one secondary button. Pressing switches to the other language.

### 5.3 Theme toggle

A 34px secondary-framed group (`--button` fill, `--button-line` border, radius 8, padding 2, gap 2) with two 28px
icon buttons, sun and moon (icons 15px, radius 6). The active theme's button is filled `--ink` with its icon in
`--canvas`. The other icon is `--subtle` with no fill. With no user pick, the device's current theme shows as active.
Each button's accessible name: "Light theme", "Dark theme".

### 5.4 Tool tabs (Tools group)

Four equal columns (Paint, Fill, Select, Erase) over a 1px `--line-strong` rule. Each tab: 18px icon above a tab-role
label, padding 8 0 10, `--muted`. **Active:** `--accent` text and icon plus a 2px `--accent` underline that overlaps
the rule. Below, 10px down, a row with **Remove line** (link) on the left and **Delete all** (danger link) on the
right.

### 5.5 Palette swatches (Colors group)

An 8-column grid, gap 6, square swatches, radius 6, with an inset 1px `--swatch-edge`. It wraps to more rows when the
Palette has more colors. **Selected:** `0 0 0 2px var(--panel), 0 0 0 4px var(--ring)`. Below, 12px down, two
equal buttons: **Custom** (a 12px swatch of the custom color, radius 3, then the label) and **Image colors** (image
icon; `--faint` while the Pattern has no Image colors).

### 5.6 Disclosure row (Mirror, Size)

A full-width row, padding 10 0, 1px `--panel-rule` above the first row and below every row: icon (16), label
(control), the current values right-aligned (meta, e.g. "l–r 1 · t–b 0", "64×48 mm"), then a chevron (16,
`--muted`). Clicking opens the group's full controls **in place, below the row**, pushing what follows down; the
chevron turns up. Escape closes the open row first. (The opened content is Derived: the group's existing controls,
laid out one per line with meta values, as the collapsed summary suggests.)

### 5.7 Tool group (template)

A Tool group is a **label** (label role, `--muted`, 8px above) followed by its controls. It has no box of its own:
the Toolbox is the box, and groups sit 20px apart inside it. Controls use the in-box button variants. Rarely used
groups (Mirror, Size) are disclosure rows (§5.6) instead of always-open groups. A new group picks one of the two.

The Edit group is four equal 38px icon buttons, gap 6: Undo, Redo, Rotate, Copy (icons 17). Save and Export are not
in the Toolbox (§5.10).

### 5.8 Expandable panel (Beads needed, Saved Patterns)

A box that shows a **fixed-height** summary and grows **downward** when expanded.

- **Header** (28px tall, 8px to the body): title in control role, with an optional muted suffix (" · 1 200" in
  body weight), optional meta on the right ("5 of 12"), then the **expand** button (↓ arrow). Expanded: the button
  shows ↑, the meta can add a `kbd` "esc" hint, and **Escape** or ↑ collapses it.
- **Body:** fixed height while collapsed (content beyond it is hidden). When expanded it takes its natural height, but
  never less than the collapsed height. It pushes the boxes below it down, and the left column scrolls if it needs to.
- **Beads needed:** title "Beads needed" + " · {total}". The body holds up to 3 color rows, 32px each (96px), each
  with a 1px `--line-soft` rule above: a 12px swatch (radius 3, inset edge), the color name (body, `--body`) and the
  count (meta, `--ink`, right-aligned). Expanded, it shows every color.
- **Saved Patterns** (§5.9): the body holds the 5 most recently saved Patterns (104px). Expanded, it shows every
  Pattern plus a footer, with a 1px `--line-soft` rule, 12px above and 14px inside: **Export Pattern** and **Export
  all** (secondary in a box, 32px, 13px text).

### 5.9 Saved Pattern thumbnail

A 5-column grid (row gap 12, column gap 4). Each cell is centered: a 44px circle on `--elevated` with the Pattern's
own thumbnail (36px) inside, then 6px down its name (small role, at most 58px wide, wrapping to two lines) and its
size (meta-tiny, `--muted`).

- **The open Pattern:** a ring `0 0 0 2px var(--panel), 0 0 0 4px var(--accent)`, and its name in `--accent`.
- **Remove:** a 20px round × button (`--panel` fill, 1px `--line-strong`, icon 11) at the circle's top-right
  (top −4, right 2). It appears on hover or keyboard focus. Clicking a thumbnail opens that Pattern.

### 5.10 Save box

Elevation 1, padding 16 20.

- **Label row:** a 14px check icon in `--accent` and "saved · this device" (label role). This reports the Pattern
  library's save state ([ADR 0012](docs/adr/0012-saving-follows-the-pattern-library.md)). When a save fails, the
  icon becomes a `--danger` warning and the text says so (Derived).
- **Buttons**, 38px, 8 apart: **Save Pattern** (primary, fills the row) and **Export ▾** (secondary in a box, with a
  trailing chevron). Export opens a menu (§5.13) with **QR code**, **PNG image** and **PDF for printing**. The QR code
  item opens the QR export panel as a modal.
- **Formats hint:** "qr · png · pdf" (meta-small), right-aligned under Export, 6px down.

### 5.11 Progress bar

56px tall, padding 0 12 0 16, gap 12, left to right:

1. **Show row progress switch:** 30 × 18, radius full. On: `--accent` track with a 12px `--on-accent` knob at the
   right. Off: `--box-button-line` track with a white knob at the left. `role="switch"`, named "Show row progress".
2. **"Row 12"** (control, with 2px extra space before it), then **"of 30 · Top to bottom"** (meta).
3. **Track:** fills the free width, 4px, radius full, `--track`, with a `--track-fill` bar showing the finished share.
4. **Turn row direction:** icon button.
5. **Row not done:** button with a left chevron. It moves the current row back one.
6. **Row done:** primary button with a check. It marks the current row finished and moves on.

**While Row progress is off** (Derived): only the switch and a "row progress" label (label role) show. The bar keeps
its height, so the canvas doesn't jump.

### 5.12 Message (notice / toast) — Derived

For "couldn't save", import results and errors, confirmations of an action.

- **Shape:** `--panel` fill (light) / `--elevated` (dark), 1px `--panel-line` (light) / `--line-strong` (dark),
  radius 12, elevation 3, padding 12 16, max width 420. A 3px left edge in the message's tone: `--accent` for
  info/success, `--warning`, or `--danger`.
- **Content:** a 16px icon in the tone color, the text (body), and optional actions as text buttons, plus a close ×
  (icon button, 28px) at the right.
- **Placement:** library-wide notices use the notice row under the header, full width, at elevation 0. Short-lived
  results (e.g. "Pattern exported") show as a toast at the bottom-right of the canvas box, 16px in, above the
  Progress bar, and go after 5s unless hovered or focused. Errors stay until closed.
- Import results and errors keep showing beside the header button that caused them, as a compact one-line message
  (no shadow, no close).

### 5.13 Popup, modal and menu — Derived

- **Modal** (confirmations such as Delete all? and Replace bead?, the QR export panel, the keyboard shortcuts):
  centered, width 420 (confirm) to 560 (panels), `--canvas` fill in light / `--panel` in dark, radius 12, elevation
  3, padding 24.
  - **Scrim:** `rgba(0,0,0,.32)` in light, `rgba(0,0,0,.6)` in dark.
  - **Title:** control role at 16/24 600.
  - **Body:** body role.
  - **Actions:** right-aligned, 8 apart. The confirm is primary, or a danger-filled button (`--danger`, white text)
    for destructive actions; cancel is secondary.
  - Escape and the scrim cancel. Focus is trapped inside while open and returns to the opener on close.
- **Menu** (Export ▾): anchored under its button, 4px gap, `--canvas` / `--panel` fill, radius 8, elevation 3,
  padding 4. Items are 34px, radius 6, icon + label; hover/focus uses `--surface` / `--elevated`.
- **Tooltip** (the Estimated size warning, icon-button names): `--ink` fill with `--canvas` text, 12/16 Inter 500,
  radius 6, padding 6 8, and no shadow.

---

## 6. Icons

The app's own line icons: 24px grid, `stroke: currentColor`, stroke-width 1.75, round caps and joins, no fill.

| Where | Size |
|---|---|
| Buttons | 15px |
| Links, disclosure rows | 16px |
| Zoom buttons | 16px |
| Edit buttons | 17px |
| Tool tabs | 18px |
| Brand mark | 22px |

The theme toggle adds **sun** and **moon**, and expandable panels add **arrow down** and **arrow up**.

---

## 7. Bead drawing

The Pattern renderer ([ADR 0018](docs/adr/0018-pattern-drawn-by-one-renderer-not-a-dom-cell-per-bead.md)) keeps
its structure. Only the look changes, through `PatternTheme` and the bead drawer (`src/rendering/beadLook.ts`).

- **Board:** the beads sit on a `--board` rounded rectangle (radius 32) with 14px padding. The rulers sit outside it,
  top and left (DM Mono 11, `--ruler`, every 5th number plus the current row's in `--marker`, weight 700).
- **Beads:** a 2px gap between beads. A bead's shape still comes from its Form factor and Technique. A rounded bead
  (the approved screenshots show a Cylinder 11/0 on Loom) has corners at 22% of its width. Light draws a faint rim,
  `rgba(20,20,19,.12)` at 0.75px; dark draws none.
- **Finished rows:**
  - Light: each bead's own color faded toward the board: 28% color, 72% `--board`. It is not grey.
  - Dark: the bead's grey (the renderer's existing `greyscale()`) at 45% over the board.
- **Current row:** a 2px `--marker` outline, 3px outside the row, radius 5.

| `PatternTheme` field | Light | Dark |
|---|---|---|
| `background` | `#e8e3df` | `#1a1a1a` |
| `rim` | `rgba(20,20,19,.12)` | none (`#1a1a1a`) |
| `emptyBead` (Derived) | `#d8d2cc` | `#2a2a2a` |
| `seam` (brick stitch) | `#1f1f1f` | `#888888` |
| `marker` | `#1f1f1f` | `#faff69` |
| `outline` (hover with no color) | `#1f1f1f` | `#ffffff` |

PNG and PDF exports use the light values (§2).

---

## 8. Copy

- "Previous row" is **"Row not done"**; "Next row" is **"Row done"**.
- Group labels and meta are lowercased by style, not in the strings (§3.2).
- The app's own words only: no brand names, no marketing phrases. English and Russian as today.

---

## 9. What changes from today's app

A map for implementation tickets. The current UI follows ADRs 0004 and 0005, which
[ADR 0021](docs/adr/0021-visual-language-follows-design-md.md) amends.

| Area | Today | DESIGN.md |
|---|---|---|
| Tokens | ticket 02's palette (`--color-ink #1d3658`, thick 3px outlines, 14/22px radii, Segoe UI 18px) | §3, two themes |
| Themes | light only | light + dark, device default, header toggle (§2, §5.3) |
| Layout | left column holds the Toolbox rail (200px) or the New Pattern form; Beads needed and Saved Patterns sit below the canvas; the page scrolls | one 326px left column with four boxes that scrolls on its own; the canvas box fills the rest; the page doesn't scroll (§4) |
| Toolbox | groups Tools, Colors, Edit (with Save, QR/PNG/PDF export), Mirror, Size, Row progress; 4-per-row control grid | Tools as tabs, Colors, Edit; Mirror and Size as disclosure rows; Save and Export in the save box; the Row progress group removed (§4.2, §5.4–5.7) |
| Row progress | Enabled/Direction toggles in the Toolbox; Progress bar placed by Pattern shape and hidden while off | switch, readout, direction, Row not done, Row done all in one Progress bar along the canvas box's bottom edge, always shown (§5.11) |
| Zoom | cluster at the canvas panel's top-right | in the canvas box's header strip (§4.3) |
| Saved Patterns | a list of every Pattern | 5 most recent as round thumbnails, expandable (§5.9). **Needs a last-saved order, which the Pattern library doesn't have yet** (CONTEXT.md) |
| Beads needed | list with total | expandable panel, total in its title (§5.8) |
| Bead drawing | white background, paper rim, grey dimmed rows | board, per-theme colors, light rows fade toward the board (§7). The renderer's reference images (ADR 0018) are redrawn for the new look |
| Fonts | system UI | Inter, DM Mono, Instrument Serif, bundled (§3.2) |

Tickets 75 (Toolbox), 76 (messages and popups) and 77 (landing page) implement against this file.

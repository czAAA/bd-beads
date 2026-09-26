# DESIGN.md — bd-beads visual language

The single reference for how bd-beads looks: tokens, layout and component templates for the light and the dark
theme. Every UI change follows it (see [ADR 0021](docs/adr/0021-visual-language-follows-design-md.md)); a need it
doesn't cover is added here first, then built.

It documents the design approved in ticket 135. The two approved screenshots, `docs/design/light.png` and
`docs/design/dark.png` (1440 × 900), show it; where this file and a screenshot disagree, this file wins. Anything the
screenshots don't show (messages, modals, hover and focus states, the empty Row progress state) is marked
**Derived**: worked out from the same tokens, not approved pixel by pixel.

The same design, with its logo, icon and favicon files, component previews and machine-readable tokens, lives in
[`docs/design/system/`](docs/design/system/README.md) (§10). This file is the spec; that folder holds the files the
spec points at.

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
| small | Inter | 12 / 15 | 500 | | Saved Pattern names under thumbnails; tooltips |
| title | Inter | 16 / 24 | 600 | | Modal titles (Derived) |
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

### 3.6 Contrast

The source values are kept exactly. Where one falls short of 4.5:1, the rule for using it is:

- White `--on-accent` on the light `--accent` is 3.3:1. Use it for icons and bold 19px+ text, not for 14px labels. On
  `--accent-hover` it is 5.0:1.
- The light `--accent` as text on `--panel` is 3.0:1. Keep it to short active labels (the active tool, the open
  Saved Pattern's name).
- Light `--subtle` is 3.4:1 on `--canvas`: secondary glyphs only ("/ RU", the inactive theme icon).
- `--ruler` is 3.3:1 (light) and 2.5:1 (dark) by design; the current row's number uses `--marker`.
- In dark, `--muted` on `--elevated` is 4.4:1. Keep dark meta on `--panel` or `--box`.
- `--warning` is never text: only a message edge or a warning icon.
- Everything else passes 4.5:1 in both themes.

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

1. **Brand:** the logo mark (§6.2: 22px, `--accent`, stroke 3.8) and "bd-beads" (brand), 8px apart, 10px extra space
   after.
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

## 6. Icons and logo

### 6.1 Icons

The app's own line icons, **Icons v2**: 40 icons in [`docs/design/system/assets/Icons/`](docs/design/system/assets/Icons).
24px grid with a keyline of 3.5 to 20.5, `stroke: currentColor`, stroke-width 1.75, round caps and joins, no fill.
Containers use 2.5 corners (1.75 on small modules). Draw as few strokes as the meaning needs.

**The signature is the bead.** Wherever an icon has a point, a drop, a ray or a module, draw it as a round bead: a
zero-length stroke (`M x y h.01`) at stroke-width 2.6, which round caps turn into a dot. Paint is a pin placing a
bead. Fill's bucket drops one. Select is a frame strung from beads (`stroke-dasharray: 0 4`, width 2.4), and so is the
mirror axis. The sun's rays, the QR modules and the Pattern's 3×3 grid are beads too, and so is the dot on info and
warning. Use the bead where it carries meaning, not on every icon.

| Where | Size |
|---|---|
| Buttons | 15px |
| Links, disclosure rows, zoom buttons, messages | 16px |
| Edit buttons | 17px |
| Tool tabs | 18px |
| Expand button, saved check | 14px |
| Brand mark | 22px |

**Color:** icons take their text color (`--ink`; `--muted` for chevrons; `--accent` on the active tool; `--on-accent`
inside primary buttons; `--danger` on Delete all; the message's tone color in messages; `--faint` when disabled).
The SVG files carry a fixed `#1f1f1f` stroke because an `<img>` can't inherit color, so **inline them in UI** and set
`stroke: currentColor`.

**Which icon goes where:**

| Icons | Where |
|---|---|
| `paint` `fill` `select` `erase` | The four tools; `remove-line` and `delete` sit under them |
| `undo` `redo` `rotate` `copy` | The Edit row |
| `image` | Image colors, and the PNG image menu item |
| `save` `export` | Save Pattern, Export ▾; `qr-code` and `pdf` are the other Export menu items |
| `import` `scan` | Import a file, Import QR code (`plus` is New Pattern) |
| `sun` `moon` `keyboard` | Theme toggle, Keyboard shortcuts |
| `mirror-horizontal` `mirror-vertical` `mirror-copy-mode` `size` | Mirror and Size controls |
| `grid` `zoom-out` `zoom-in` `fit` | Canvas box strip |
| `turn-row-direction` `chevron-left` `check` | Progress bar: direction, Row not done, Row done |
| `arrow-down` `arrow-up` | Expand and collapse a panel |
| `chevron-down` `chevron-up` | Selects, disclosure rows, Export ▾ |
| `info` `warning` `close` | Messages |
| `row-progress` | Kept for the legacy Row progress group only |

`docs/design/system/assets/Icons v1/` holds the 23 icons the app ships today, for reference until it switches over.

### 6.2 Logo

**The X1 Cross-weave mark:** two linked beads (the bowls of b and d) with the two stems rising, crossing and passing
through a shared third bead from opposite sides, as two needles do in ladder weave. The loose thread tails flick out
past the stems. It follows the icon rules: one stroke, round caps and joins, no fill. There is no outlined wordmark
file: set "bd-beads" in the brand role, to the right of the mark, 8px apart at header size.

- **Color:** `--accent` on `--canvas` (orange in light, yellow in dark), `--on-accent` on an `--accent` tile (the app
  icon), or one color in `--ink` or `--canvas`. Nothing else: no gradients, shadows, outlines or other colors.
- **Stroke** on the 48-unit grid: 3.2 by default, 3.6 at 32px, 3.8 at 22px (the header), 4.2 at 16px. It gets
  heavier as it shrinks so it keeps the same weight to the eye. Use `bd-beads-mark-small.svg` at 16 to 20px.
- **Clear space:** a quarter of the mark's height on every side. **Minimum size:** 16px.
- **Don't:** fill the beads, vary the stroke within the mark, rotate, stretch or flip it, move the shared bead, cut the
  tails, or turn it into a face.
- **Files** in [`docs/design/system/assets/Logos/`](docs/design/system/assets/Logos): `bd-beads-mark.svg` (light
  accent), `bd-beads-mark-dark.svg`, `bd-beads-mark-ink.svg`, `bd-beads-mark-white.svg`, `bd-beads-mark-small.svg`,
  `bd-beads-app-icon.svg` and `bd-beads-app-icon-dark.svg` (the mark on an accent tile). In UI, inline the mark and
  set `stroke: var(--accent)`.
- Before the mark is registered as a trademark, run an image search (WIPO Global Brand Database, EUIPO TMview) and a
  professional clearance search.

### 6.3 Favicon

The favicon is the mark at the small stroke (4.2). It follows the **browser's** light or dark setting, not the app's
theme toggle, because the tab bar belongs to the browser: orange `#fa520f` on light tab bars, yellow `#faff69` on dark
ones.

- Ship one `favicon.svg` with its own `prefers-color-scheme` rule (the source is in
  [`docs/design/system/README.md`](docs/design/system/README.md), "Favicon"). Chrome, Edge and Firefox switch it live;
  Safari may keep the light version.
- Fallbacks: `favicon.ico` (16, 32, 48) for older browsers, `favicon-32.png`, and `apple-touch-icon.png` (180×180,
  white mark on full-bleed `#fa520f`).
- The Logos folder holds `favicon.svg` (light) and `favicon-dark.svg` as separate single-color files, plus
  `favicon-32.png` and `apple-touch-icon.png`. The theme-aware file is built from the source in the README.

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
- Sentence case in every string ("Save Pattern", "Beads needed"). Product nouns are capitalized: Pattern, Bead,
  Palette, Technique, Row progress.
- Join meta values with a spaced middle dot ("40 columns · 30 rows", "l–r 1 · t–b 0"). Use × for sizes ("40×30",
  "64×48 mm").
- No emoji.
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
| Icons | Icons v1: 23 icons drawn inline in the Vue components | Icons v2: 40 icons with the bead signature (§6.1). Files in `docs/design/system/assets/Icons/` |
| Logo, favicon | a QR-style bead-grid `public/favicon.svg`; a generic bead glyph in the header | the X1 mark in the header and as a theme-aware favicon, with `.ico`, PNG and Apple touch icon fallbacks (§6.2, §6.3) |

Tickets 75 (Toolbox), 76 (messages and popups) and 77 (landing page) implement against this file.

---

## 10. Design system files

[`docs/design/system/`](docs/design/system/README.md) is a copy of the bd-beads design system (a Claude design system
artifact), kept in the repo so every developer and agent has the same files without an account.

| Path | What it is |
|---|---|
| `README.md` | The brand book: principles, content, color, type, logo, favicon and iconography rules |
| `tokens.json` | Every token as data: colors for both themes, type styles, spacing, radii, elevation |
| `components/bundle.css` | Static styles behind the component previews; also holds values that aren't plain color tokens (`--track-fill`, the modal scrims) |
| `components/<Name>/README.md`, `preview.html` | A short guideline and a static preview per component (17 components and the cover). Open a preview in a browser to see it |
| `assets/Logos/` | The mark, the app icons and the favicon files (§6.2, §6.3) |
| `assets/Icons/` | Icons v2, 40 SVGs (§6.1) |
| `assets/Icons v1/` | The icons the app shipped before Icons v2, for reference |

**Which one wins:**

- For tokens, layout and component behavior, **this file wins**. `tokens.json` and the component READMEs restate it.
  When they disagree, fix them to match this file.
- For the logo, icon and favicon **files**, the SVG and PNG files in the folder are the source. This file describes
  how to use them.
- The previews are static renditions written from this file. They are not the app's components, so the Vue
  components stay the implementation.

**Keeping the copy current:** the claude.ai design system is where the design is edited. After a change there, copy
its files over `docs/design/system/` in one commit, together with the matching change to this file. Don't edit the
folder by hand except to fix a mismatch with this file. Its previews load Inter, DM Mono and Instrument Serif from
Google Fonts for display only; the app itself bundles its fonts (§3.2).

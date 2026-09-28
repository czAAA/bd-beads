bd-beads is a bead-pattern editor. The Pattern is the largest thing on screen; everything else is compact chrome around it. Two themes, light and dark, share one layout and one set of components; only the tokens change.

## Principles

- **An editor, not a page.** Give the Pattern the space. Chrome is compact: 34px controls, 12px box radii, 14px text.
- **One accent per theme.** `accent` is orange `#fa520f` in light and neon yellow `#faff69` in dark. It marks the single most likely next action in a region (New Pattern, Replace bead, Save Pattern, Row done), the active tool, the current row, the brand mark and the open Saved Pattern. Nothing else is accent-colored. Two primary buttons never sit next to each other.
- **Flat, with hairlines.** Light separates surfaces with 1px hairlines (`line`, `line-soft`, `panel-line`) and a few soft shadows (`elevation-1`–`3`). Dark uses no shadows: depth comes from four surface steps, `canvas` → `surface` → `panel` → `elevated`.
- **Strict type roles.** Inter for anything you read or press; DM Mono, lowercase, for labels and meta; Instrument Serif italic only for the background word.
- **Nothing borrowed.** No company or product names, logos or imagery. Colors, fonts and copy are the app's own.

## Content

- The app's own words only: no brand names, no marketing phrases. English and Russian.
- Sentence case in every string ("Save Pattern", "Beads needed"). Product nouns are capitalized: Pattern, Bead, Palette, Technique, Row progress.
- Labels and meta are lowercased **by style** (`text-transform: lowercase` on `label`, `meta`, `meta-small`), never in the string, so the same string works outside a label: "currently editing", "saved · this device", "qr · png · pdf".
- Join meta values with a spaced middle dot: "40 columns · 30 rows", "↔ 1 · ↕ 0". Use × for sizes: "40×30" for beads, "6.4 × 4.8 cm" for measured sizes (spaced, one unit, cm from 10 mm up).
- Group thousands with a no-break space: "1 200". Weights in grams, rounded up to 0.1: "≈ 24 g". Russian uses a decimal comma ("9,6 см"). The full rules, the glossary and the Russian strings are in the Writing section.
- No emoji.
- No em dashes

## Color

- Page and header on `canvas`. The four left-column boxes on `panel` with a 1px `panel-line` border (invisible in dark). Dividers inside a box are `panel-rule`. Buttons and thumbnails inside a box sit on `elevated`.
- The canvas box is `box` with a 1px `box-line`; the bead board inside it is `board`. Meta text in the canvas strip and Progress bar is `box-muted`; their dividers are `box-muted` at 22% opacity.
- Text: `ink` for primary text and icons, `body` for secondary text, `muted` for labels and meta, `subtle` for the "/ RU" glyphs and inactive theme icon, `faint` only for disabled, `accent-strong` for accent-coloured text.
- Status: `danger` for Delete all, errors and destructive confirms; `warning` only as a message edge or warning icon, never as text.
- The Progress bar fill is a gradient in light, `linear-gradient(90deg, #fa520f, #ffa110)`, and `#faff69` in dark. It isn't a single color, so it isn't a token. Use `--track-fill` from `components/bundle.css`.
- Contrast: every text is 4.5:1 and every meaningful mark 3:1 in both themes. Labels on orange are dark (`on-accent` #1f1f1f); accent as text or a thin mark on light surfaces is `accent-strong`; fields use `field-line`; the focus ring is `focus-ring`. The Accessibility and stacking section has the audit and the rules.

## Type

- `brand` (Inter 18/1 700, −0.3px) is only for "bd-beads".
- `control` (14/20 500) is for buttons, selects, row labels and box titles. `body` (14/20 400) is for running text. `tab` (13/18 500) is for tab labels and small buttons. `pill` is for the Bead pill. `small` (12/15 500) is for Saved Pattern names. `title` (16/24 600) is for modal titles.
- `label` and `meta` (DM Mono 13/18) are for group labels and values next to a label. `meta-small` (12/16) and `meta-tiny` (11/15) are for hints, counts and sizes. `ruler` (DM Mono 11) is for the canvas rulers, with the current row at 700 in `marker`.
- `word` (Instrument Serif italic 240/1, −4px, in `word`) is only for the background technique word.
- Cyrillic: DM Mono and Instrument Serif have none, so the stacks fall back per glyph to JetBrains Mono and Source Serif 4 (Cyrillic subsets only).
- The app bundles its fonts as woff2 (Inter 400/500/700, DM Mono 400, Instrument Serif italic 400, plus the two Cyrillic fallbacks) and never loads them from a font CDN, because it works offline and makes no third-party requests. This design system's previews load them from Google Fonts for display only.

## Spacing, radii, elevation

- The base is 4px, with 2px and 6px steps for tight control groups: `space-2` … `space-32`.
- Page padding is 24/32. The header is 64px tall with 0 32 padding and a 10px gap. The left column is 326px (312px boxes plus a 14px scrollbar gutter), with 16px between boxes. The Toolbox has 24px padding and 20px between groups. The save box is 16 20, and the panels are 14 20 16.
- Radii: `radius-xs` for kbd hints. `radius-sm` for swatches and small icon buttons. `radius-md` for buttons and selects. `radius-lg` for every box, the canvas box and modals. `radius-board` for the bead board. `radius-full` for pills, switches, thumbnails and round buttons. Beads have corners at 22% of their width.
- Elevation: `elevation-1` for the save box, Beads needed and Saved Patterns. `elevation-2` for the canvas box. `elevation-3` for modals, menus and messages. Every elevation is `none` in dark, where overlays add a 1px `line-strong` border.

## Layout

The page never scrolls. The 64px header is on top. Below it, a 326px left column scrolls on its own and holds four boxes in fixed order: Toolbox, save box, Beads needed, Saved Patterns. The canvas box takes all the remaining width and height: a 46px strip, then the drawing area (rulers plus board, with the technique word and a 1.5px `curve` behind), then the 56px Progress bar, which is always shown. This is the MacBook Air tier (reference viewport 1440 × 900). The Responsive section defines the other four tiers, from phone to 24″ displays: on a phone the Pattern and the Progress bar come first and every other control sits behind a Dock of six buttons, each opening its own ToolSheet; on an iPad mini the left column becomes a Drawer and a BottomToolbar keeps the tools at hand. Every tool the desktop has is reachable at every size. Forms, empty, loading and error states follow the Forms and states section.

## States

- Focus: every interactive element gets `outline: 2px solid focus-ring; outline-offset: 2px`, keyboard only (`:focus-visible`); 3px in high contrast.
- Hover (mouse and trackpad only) is one step of fill, `--hover-fill`; pressed is one more step, `--press-fill`, and a slight shrink; primary uses `accent-hover` for both. Disabled primary uses `accent-disabled-bg` / `accent-disabled-fg`.
- Selected swatch: `0 0 0 2px panel, 0 0 0 4px ring`. The open Saved Pattern: the same ring in `accent-strong`.
- The full state rules and the motion tokens (`--duration-*`, `--ease-*`) are in the Interaction and motion section.

## Themes

The header's four-way theme control (Match device, Light, Dark, High contrast) starts on Match device, which follows `prefers-color-scheme` and `prefers-contrast: more`. High contrast is `data-theme="contrast"`; see the Accessibility and stacking section. After that the pick sticks and is remembered on the device. The app sets `data-theme="light|dark"` and `color-scheme` on `<html>` before first paint. PNG and PDF exports always use the light values; their layout is in the Printed output section.

## Logo

- **The mark is X1 Cross-weave:** two linked beads (the bowls of b and d) with the two stems rising, crossing and passing through a shared third bead from opposite sides, as two needles do in ladder weave; the loose thread tails flick out past the stems. It is drawn with the icon rules: one stroke, round caps and joins, no fill.
- **Wordmark:** "bd-beads" in the `brand` style (Inter 700, −0.3px at 18px), set to the right of the mark, 8px apart at header size. There is no outlined wordmark file; set it in type.
- **Colour:** `accent` on `canvas` (the default: orange in light, yellow in dark), white on the light `accent` tile and `on-accent` on the dark one (the app icons), or one colour in `ink` or `canvas`. Nothing else: no gradients, shadows, outlines or other colours.
- **Stroke:** 3.2 on the 48-unit grid, heavier as it gets smaller so it keeps the same weight to the eye: 3.6 at 32px, 3.8 at 22px (the header), 4.2 at 16px (use `bd-beads-mark-small.svg`).
- **Clear space** is a quarter of the mark's height on every side. **Minimum size** 16px.
- **Don't** fill the beads, vary the stroke within the mark, rotate, stretch or flip it, move the shared bead, cut the tails, or turn it into a face.
- **Files** (the Logos group): `bd-beads-mark.svg` (accent, light), `bd-beads-mark-dark.svg` (accent, dark), `bd-beads-mark-ink.svg` and `bd-beads-mark-white.svg` (one colour), `bd-beads-mark-small.svg` (16–20px), `bd-beads-app-icon.svg` and `bd-beads-app-icon-dark.svg` (the mark on an accent tile). In UI, inline the mark and set `stroke: var(--accent)`. Favicon files are listed under Favicon below.
- Before registering the mark, run an image search (WIPO Global Brand Database, EUIPO TMview) and a professional clearance search.

### Favicon

The favicon is the mark itself, at the small stroke (4.2), and it follows the **browser's** light or dark setting: orange `#fa520f` on light tab bars, yellow `#faff69` on dark ones. It follows the browser or system theme, not the app's own theme toggle, because the tab bar belongs to the browser.

- Ship one `favicon.svg` with its own `prefers-color-scheme` rule (below). Chrome, Edge and Firefox switch it live; Safari may keep the light version.
- Fallbacks: `favicon.ico` (16, 32, 48) for older browsers, `favicon-32.png`, and `apple-touch-icon.png` (180×180, white mark on full-bleed `#fa520f`; iOS rounds the corners).
- The Logos group holds `favicon.svg` (light) and `favicon-dark.svg` (dark) as separate single-ink files, plus `favicon-32.png` and `apple-touch-icon.png`, because the asset store strips `<style>` from SVGs. The theme-aware file is this source:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <style>
    .m { fill: none; stroke: #fa520f; stroke-width: 4.2; stroke-linecap: round; stroke-linejoin: round; }
    @media (prefers-color-scheme: dark) { .m { stroke: #faff69; } }
  </style>
  <g class="m"><path d="M6.16 28V16C6.16 11 35.84 8 40.84 3" /><path d="M41.84 28V16C41.84 11 12.16 8 7.16 3" /><circle cx="24" cy="8.8" r="3.4" /><circle cx="17.16" cy="28" r="11" /><circle cx="30.84" cy="28" r="11" /></g>
</svg>
```

In `index.html`:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

## Iconography

- **Icons** (the Icons group, 47 icons) replaces every icon the app draws. Rules: 24-unit grid, keyline 3.5–20.5, stroke-width 1.75, round caps and joins, no fill, `stroke: currentColor`. Containers use 2.5 corners (1.75 for small modules). Draw as few strokes as the meaning needs.
- **The signature is the bead.** Wherever an icon has a point, a drop, a ray or a module, draw it as a round bead: a zero-length stroke (`M x y h.01`) at stroke-width 2.6, which round caps turn into a dot. Paint is a pin placing a bead. Fill's bucket drops one. Select is a frame strung from beads (`stroke-dasharray: 0 4`, width 2.4), and so is the mirror axis. The sun's rays, the QR modules and the Pattern's 3×3 grid are beads too. The dot on info and warning is a bead. Use the bead where it carries meaning, not on every icon.
- Sizes: 15 in buttons, 16 in links, disclosure rows, zoom and messages, 17 in the Edit row, 18 in tool tabs, 14 in the expand button and saved check, 22 for the brand mark.
- Color: icons take their text color (`ink`, `muted` for chevrons, `accent` on the active tool, `on-accent` inside primary buttons, `danger` on Delete all, the message's tone color in messages, `faint` when disabled). As files they carry a fixed `ink` (#1f1f1f) stroke, because `<img>` can't inherit color. Inline them in UI.
- Which icon goes where: paint, fill, select and erase are the tools. remove-line and delete sit under them. undo, redo, rotate and copy are the Edit row. image covers Image colors and the PNG image menu item. save goes on Save Pattern, export on Export ▾, qr-code and pdf on its menu items. import and scan go on Import a file and Import QR code, plus on New Pattern. device, sun, moon and contrast are the four-way theme control, keyboard is Keyboard shortcuts. mirror-horizontal, mirror-vertical and mirror-copy-mode are the Mirror controls, and size is the Size row, doubling as the phone header's own bead/technique selector (ticket 188) since both surface the same Bead. grid, zoom-out, zoom-in and fit are the canvas strip. The Progress bar uses turn-row-direction, chevron-left (Row not done) and check (Row done). arrow-down and arrow-up expand and collapse a panel. chevron-down and chevron-up mark selects and disclosure rows. info, warning and close are for messages. more (three beads) opens the header's OverflowMenu on phone and iPad mini, and sidebar is the iPad mini's Tools button that opens the Drawer. row-progress is kept for the legacy Row progress group. bead (a rounded bead module with its drilled hole) is the app's own mark at header widths too narrow for the wordmark, with the app name as its hover label; library (three shelved spines) marks Saved Patterns at every tier; paste (a clipboard with two lines) is the phone Edit sheet's Paste, replacing its former reuse of import.
- The **Icons v1** group keeps the 23 icons the app ships today, copied from its components, for reference until the app switches over.

## Not synced

- The Vue components in `src/components/` still use the old style (ticket 02), so they weren't bundled. The component cards are static renditions hand-written from DESIGN.md §4–§7.
- There are no font files in the repository yet; the owner adds them under `public/fonts/` (Inter, DM Mono, Instrument Serif, JetBrains Mono and Source Serif 4 for Cyrillic, all SIL OFL). The previews load them from Google Fonts until then.
- The Progress bar's light gradient fill (`--track-fill`) and the modal scrims can't be color tokens, so they live in `components/bundle.css`.
- Phase E is decided but not built: the four-way theme control, Name on exports in the Export menu, the bead cursor for keyboard painting, landscape and stacked exports, the high-contrast pressed fills, and the text-fitting rules (header by priority, wrapping segments, ContextBar icons, one-line thumbnail names).
- Phase D is decided but not built: the new PDF and PNG layouts, a beads-per-gram field on each catalog Bead (Delica 11/0 ≈ 200, TOHO Round 11/0 ≈ 110–120, TOHO Cube 1.5 mm still to be weighed), an optional "Your name" setting for the exports, Palette color names, and the string fixes listed in the Writing section.
- The X1 logo, Icons v2, the responsive tiers, the Forms and states designs and the Phase C colour changes (dark labels on orange, `accent-strong`, `field-line`, the high-contrast theme) are decided for the app but not yet in its code (tickets 79 and 83 build the tiers). New copy approved with Phase A: "Scan it with Import QR code on another device.", "Make one with New Pattern on the left, open a Saved Pattern, or import a file.", "Opening {Pattern} · {size}", "Converting the picture · {percent}", and the Image colors reason "No image colors: this Pattern was not converted from a picture."
- The `src/style.css` tokens (the old navy/peppermint palette) were skipped on purpose: DESIGN.md replaces them.

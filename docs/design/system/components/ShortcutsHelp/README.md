# ShortcutsHelp

Keyboard shortcuts: every key and gesture the editor answers, grouped as in the Toolbox, as a **Subpanel of Menu**.

Approved 2026-11-20 on the "Keyboard shortcuts in Menu" canvas (variant A4), built by ticket 1159 in place of the
earlier centred Modal.

## Where it opens

- **A Menu Subpanel** (MenuPanel card, Subpanels), like the Projects library: Menu › Help › **Keyboard shortcuts** (the
  row keeps `?` as its value and gains the › mark) pushes it under the Back arrow and its title. It is no Modal: it hangs
  from the Menu button, over the Canvas, with no scrim.
- **`?`** opens Menu straight on this Subpanel; Escape then closes the panel (the Subpanel was the opening view), and
  Back shows Menu's list. `?` again, or the lit Menu button, closes it.
- The header's right holds the `?` key as a Kbd chip, where a Subpanel's meta sits, wherever key hints show (as the
  Help row's `?` value).
- Shown only when a keyboard is present, as before. On the Homepage the same Subpanel opens from its Menu (the What's
  inside demo included), not a page Modal.

## The panel

- **Wider than Menu:** this one Subpanel is `panel-width-wide` (46rem; 828px at the app's 18px root). Pushing it widens
  the dropdown from `panel-width`; Back narrows it again. Its left edge stays under the Menu button. It is the one
  exception to "the dropdown keeps `panel-width`", because two even columns need the room.
- Where the window can't hold 46rem plus the 8px gutters (an iPad mini upright, a phone), it takes the window's width
  less the gutters, and each group falls to **one column** once a column would be narrower than 22rem. The full
  panel's padding and edge leave each column a hair under that, so the line is drawn where the body is under 44rem:
  two columns at full width, one on an iPad mini or a 10th-generation iPad upright (744, 820px).
- As tall as it needs, up to the panel's usual limit (MenuPanel card, Panel); past that its body scrolls with the fade
  and thumb every panel has. On a 1440×900 screen it scrolls a little.
- **First row, full width:** Show key hints (`keyboard` icon, the label in `control`, a Switch at the end, as Lifted
  pieces in Menu), the device's choice (ticket 438). Then a `line-soft` rule.

## Groups

- Each group is a **PanelSection that never folds** (the fixed heading: `label` style, DM Mono, lowercase, `muted`, no
  chevron), across the panel's full width, split from the next by the panel's `line-soft` rule. Order: tools, colors,
  edit, canvas, on a handle, row progress.
- **Under its heading, a group's rows run in two equal columns**, filled **down the left first**: the left takes the
  larger half. 10 rows are 5 + 5; 3 rows are 2 + 1, with the space under the right column left empty. Never balanced
  across groups and never reordered to fill a gap.
- The two columns of a group are **one grid**: a row and its neighbour across share a height, so a name that wraps on
  one side moves both down together. 1rem between the columns, no rule between them.
- A group with a condition says it in one `meta-small` / `muted` line under its heading, from the label column (on a
  handle: "Tab to the handle first, then:").

## A row

- **Two tracks:** the name, then the keys in a fixed track, `shortcut-keys-width` (9rem), left-aligned. Every key in the
  panel starts at the same x within its column, close to its name. The keys never wrap and never drop under the name:
  a long name wraps in its own track, and the keys stay on its first line. On a phone, where the name's track is
  narrower than some single words, such a word breaks inside itself (only one that fits no line) rather than push the
  keys out. 9rem holds the widest chord on any keyboard
  (Ctrl + Shift + S).
- The row is at least `panel-row` tall (28px; 36px on a coarse pointer), with padding 4 10, `radius-sm` and
  `hover-fill` under a fine pointer. The name is in `body` / `ink`.
- **One chord per row.** An action with two ways is two rows, each named for its way ("Scroll the Canvas" /
  "Scroll it sideways"), so the key track stays narrow and equal everywhere. Redo lists its main chord only; Ctrl + Y
  still works on a non-Apple keyboard.
- **Kbd:** 22px tall (`kbd-height`), DM Mono 12 (`meta-small`), `ink`, on `elevated`, a 1px `line-strong` edge with a
  2px bottom, `radius-xs`, padding 0 4 (0 6 for a word: Shift, Space, Enter, Esc, drag, wheel, pinch, hold,
  right-click, middle-drag). Parts are joined by `+` in `meta-tiny` / `muted`, written by the app's chord rule (no `+`
  between ⌘ and a one-character key: "⌘Z", "Shift + ⌘Z").
- **Arrows in one chip** keep a little air between them: ← ↑ ↓ → at 0.2em letter spacing, with the last arrow's spacing
  taken off the right padding so the chip stays centred.
- Keys are written for the device's keyboard (ticket 0993): ⌘, ⌥ and ⌫ on an Apple one; Ctrl, Alt and Del elsewhere.
  Key labels are locale-neutral; names are translated.
- For screen readers each row's keys are also one spoken phrase ("Shift+⌘Z"); the chips are for the eye.

## The rows

Apple keyboard shown. Rows the app answered that the Modal never listed are marked † (ticket 1159 added them).

| Group | Name | Keys |
| --- | --- | --- |
| tools | Paint · Fill · Select · Eraser · Hand · Select a Piece · Mirror · Paste tool | 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 |
| tools | Select all | ⌘A |
| tools | Back out | Esc |
| colors | A recent color | Shift + 1…3 |
| colors | Palette colors 1 to 6 | Shift + 4…9 |
| colors | Palette color 7 | Shift + 0 |
| edit | Undo · Redo | ⌘Z · Shift + ⌘Z |
| edit | Copy · Cut · Paste from clipboard | ⌘C · ⌘X · ⌘V |
| edit | Remove selected beads | ⌫ |
| edit | Remove selected row/column | Shift + ⌫ |
| edit | Rotate | Shift + R |
| edit | Save Project file · Save Project file as… | ⌘S · Shift + ⌘S |
| canvas | Rulers · Reference image | R · I |
| canvas | Zoom in · Zoom out · Fit | ⌘+ · ⌘− · ⌘0 |
| canvas | Move the Canvas | Space + drag |
| canvas | Move it from any tool † | middle-drag |
| canvas | Scroll the Canvas † | wheel |
| canvas | Scroll it sideways † | Shift + wheel |
| canvas | Zoom the Canvas | ⌘ + wheel |
| canvas | Zoom on a trackpad † | pinch |
| canvas | Tools at the pointer | right-click |
| canvas | Tools at a finger or Pencil | hold |
| on a handle | Move the selection, Piece or Mirror area † | ← ↑ ↓ → |
| on a handle | Move the Frame † | ← ↑ ↓ → |
| on a handle | Resize the Frame † | Shift + ← ↑ ↓ → |
| on a handle | Move the reference picture † | ← ↑ ↓ → |
| on a handle | … ten beads at a time † | Shift + ← ↑ ↓ → |
| on a handle | Move a Palette color † | ⌥ + ← → |
| row progress | Turn row direction | D |
| row progress | Row done | Enter |
| row progress | Back a row | Shift + Enter |

- Both Removes are in edit (Remove selected beads was in tools). Keyboard shortcuts' own `?` is the header's chip and the
  Help row's value, with no row of its own. The Palette's one row ("Select a color: 1 to 3 the recent colors, then the
  Palette in order") becomes the three colors rows.
- "Back a row", not "Previous row" (ticket 0972) (DESIGN.md §8). Save Project file and Save Project file as… are in
  edit (ticket 0796): there is no Project group.
- The Radial toolbox's rows (tickets 1064, 1065) repeat the Canvas hint, which screen readers do not hear (RadialToolbox
  card). Grid focus (`G`) is gone (ticket 1007).
- Every row is read from the control registry and its gestures list, as before; a gesture, or a key on a focused
  handle, is listed there too, so nothing the editor answers is missing here.

## Not in it

- No "new" mark on rows: the teal "new" tags on the design canvas only showed the review which rows were added.
- No Find field and no folding groups (the other variants on the canvas).

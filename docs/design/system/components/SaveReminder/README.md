# SaveReminder

A quiet reminder to save the open Project's Project file on the device: a round save button that appears on the Canvas strip, beside the Project button, once enough has been drawn since the last file (tickets 0796, 0922). Picked from five forms and five places on the design canvas "Save reminders" (form E, Ring; place 3, Canvas top right): link on ticket 0796 in the private docs repo. The canvas shows the ring filling from the first bead, but it was then decided that nothing shows before the threshold. Ticket 0922 (UX audit UX-002, the owner's verdict) moved it from the drawing area's top-right to the strip, where the Project's name is, so the one thing on screen about saving sits by the Project it saves. This card wins.

## Why it exists

Every Project lives in the browser's own storage (ADR 0001, ADR 0012), and a browser can clear that storage: when the disk runs short, after 7 days without a visit (Safari), or through Clear site data. A Project file (`.openbeads`) on the device is the copy the browser can't clear. The ring never warns or blocks: it appears when the file is well behind and saves it with one press. Nothing in its copy says "lost" or "deleted".

## Beads since last file

- **What counts:** for each Project, the bead positions that drawing changes since its Project file was last saved on this device: Paint, Fill, Eraser, Paste, the Mirror's copies and Clear all beads. A Fill that changes 300 beads counts 300, and painting a bead then erasing it counts 2.
- **What doesn't count:** changing a layer's Technique or Bead (Replace bead). Also excluded are moving the Frame or the reference image, Rotate Canvas, Row progress, renames and settings. As built (ticket 0796), an Edit that moves, resizes or turns the Frame (Rotate Frame included) counts nothing on the Frame, since its beads are counted from its own corner; the Canvas's beads it changes still count.
- **Undo** takes off the count its Edit added and **Redo** puts it back. The count never goes below 0.
- **What resets it to 0:** any Project file save of this Project: Save or Save as (from the ring, the Project panel or the keys), Save all Projects to a Project file in the Menu (it writes every Project), or Save Project file in the notice row about a Project that didn't open (ticket 0716). PNG and PDF don't reset it. The record also keeps the last file's name, which the Project panel's Save row shows (ticket 0859); a duplicate starts without one.
- **Where it starts:** a new Project counts from its first bead. An imported Project starts at 0, since it came from a file. A duplicate starts with its original's count and last-file time.
- **Where it is kept:** with the Project on the device, beside its library entry, so a reload keeps it. It is never written into the Project file. As built: the localStorage key `openbeads:since-file`, one record per Project id (`beads`, `lastFileAt`), which older builds never read; Delete, Delete all and the start-up sweep drop a record.
- **Threshold:** 50 beads. If the browser has granted persistent storage (`navigator.storage.persisted()`, ticket 399), it is 100: storage pressure can't clear the library then, though Clear site data still can.

## The ring

- **Shown** with a Project open once Beads since last file reaches the threshold. It stays until the Project file is saved, and the count going back to 0 hides it. It is hidden below the threshold, with no Project open, on the Homepage and in Convert image.
- **Place:** the Canvas strip's left slot, right after the Project button and before Frame, 2px from each (the slot's gap; CanvasStrip card). Nothing shows at the drawing area's top-right any more, and the toasts keep their own place there (Message card). It stays put when the canvas pans, zooms or turns, and its coming and going moves only Frame, by its own width.
- **Material:** the Tool pill's, without its shadow, since it sits in the strip like the buttons beside it: `elevated` fill, a 1px `line` edge, `radius-full`. It is as tall as the strip's buttons (`--strip-item-height`: 34px, 44px on a coarse pointer), so the strip never changes height, with the 26px halo (`--save-ring-halo`) centred in it.
- **Halo:** a full circle in a 26px box, stroke `--save-ring-stroke` (2px), in `accent-strong`. The `save` icon (the floppy disk) sits in it at 16px, also `accent-strong`. There is no partial arc: the ring only exists once the file is behind. The floppy means the action, saving a Project file, here and on the Project panel's Save row alone; the saved state is a check (SaveStates card, ticket 0858).
- **Appearing:** it scales from 0.6 and fades in over `--duration-slow`, with `--ease-standard`. Under reduced motion it only fades.
- **Hover** adds `--hover-fill` over the `elevated` fill. **Pressed** adds `--press-fill` and the usual slight shrink. **Focus** is the 2px `focus-ring` (3px in High contrast).
- **High contrast:** the halo and the icon are `ink`, and the edge is 2px `line-strong`.
- **Stacking:** the ring is in the strip. Its open label hangs over the drawing area at `z-chrome` (20): over the beads, the Frame, the margin sheet and the rulers, under the Selection bar (`z-context-bar`), the strip's panels (`z-popover`), toasts and dialogs.

## The label

- **When it opens:** as the ring appears, then again at every further 100 beads (150, 250, … with the 50 threshold), and once when a Project opens with its count at the threshold or above and its last file (or creation, if it never had one) 7 or more days ago.
- **Never mid-stroke:** the ring's appearance and every opening wait until no stroke, Fill or paste has landed for 3 s, and until no panel, sheet, dialog or Adjust is open.
- **What opens:** the label hangs 6px under the ring, its left edge on the ring's, over the drawing area, so it covers and moves no strip control (ticket 0922; the ring used to widen leftwards from the drawing area's corner, which in the strip would push Frame and crowd the Brand). It is a pill of the ring's material with the Tool pill's shadow (`elevation-2`, none in dark), padding 6 12: the label "Save Project file" (`tab`, 13/18 500, `ink`), then, 6px on, the count in words, "{count} beads since the last file" (`meta-small`, `muted`; a counted word, ticket 0858: a bare "+89" read as "89 beads not saved"). It is part of the button, so a press on it runs Save too. It fades in over `--duration-base` and settles from 4px higher over `--duration-slow`, with `--ease-standard`; under reduced motion it only fades. The ring's Tooltip, which says all the label does and more, shows over it on hover or focus.
- **How long:** 4 s (`--save-ring-label-time`), then it closes back to the ring. It stays open while hovered or focused and closes 1 s after the pointer or focus leaves.
- There is no "Later" and no ×: the ring is already the quiet form, and closing the label is the "later".
- **Screen readers:** a polite live region says "Beads since last file: {count}. Save a Project file to keep them." once each time the label opens.

## Press: Save

- **One action, any trigger.** A press runs **Save**, the Project file action that Save Project file in the Project panel and Ctrl/Cmd+S also run (ADR 0090). The ring adds no save path of its own, and the save-failed notice's Save Project file runs Save too. The ring, the row and the notice all say "Save Project file" (ticket 0859). **Save as** is the sibling action: Save Project file as… in the Project panel, or Ctrl/Cmd+Shift+S. The ring never runs it.
- **Linked file** (where the browser can write to a picked file, ADR 0090: Chrome, Edge and other Chromium browsers on desktop): a Project's first Save opens the system Save dialog, suggesting `{Project name}.openbeads`, and the file picked becomes the Project's Linked file. Every later Save writes into it with no dialog. If the browser has dropped its permission, the press asks again with the browser's own prompt. If that is refused, or the file was moved or deleted, Save opens the Save dialog and links the file picked, with no error. Save as always opens the dialog and links the new file.
- **Elsewhere** (Safari, Firefox, iPhone and iPad): there is no Linked file. Every Save is a new download or share sheet, as before, and Save as is hidden.
- **Feedback:** every route names the file in the one saved-file toast (Message card, ticket 0859): writing into the Linked file, into a file picked in the dialog, or a download, "Saved: {file}" (`accent` edge, the `success` tone, 5 s), in the toasts' place at the canvas box's top-right. If the dialog won't open or the write fails, Save hands the file over as a download instead, with the same toast and no error.
- Once the file is written or the download handed over, the count goes to 0 and the ring hides. A cancelled dialog changes nothing. A refused download keeps the count and shows the action's existing error toast.

## Tooltip

The Menu card's Tooltip, centred under the ring like the strip's other buttons', its meta lines being the Tooltip's `meta`:
- **Name:** "Save Project file", with the key chip `Ctrl/Cmd+S` (the control registry's chord for Save).
- **Body:** "The browser keeps your work but can clear it. A Project file stays."
- **Meta lines** (`meta-tiny`, `tooltip-muted`): "Beads since last file: {count}", then "Last file: {when}", or "No Project file yet" if it never had one. `{when}` uses `Intl.RelativeTimeFormat` with `numeric: "auto"` (today, yesterday, 2 days ago) in the app's language.

## Keyboard and accessible name

- A `button` named "Save Project file", with `aria-describedby` pointing at the count line, so the count is read with the name ("Save Project file, Beads since last file: 64"). This avoids a plural inside a sentence.
- In the tab order it follows the Project button: it is one of the strip's panel buttons (one Tab stop with ←/→ inside, ADR 0075), between Project and Frame. Enter or Space runs Save; ↓, which opens the panel of a panel button, does nothing on it.
- Ctrl/Cmd+S (Save) and Ctrl/Cmd+Shift+S (Save as) work with a Project open, whether or not the ring shows, and never fall through to the browser's Save page: they run from a text field and under an open panel or dialog (the Project panel holds the Save row), and are claimed but do nothing with no Project open. Where Save as is hidden, Ctrl/Cmd+Shift+S runs Save.

## Sizes

- **Fine pointer:** 34px, the strip's button height, as above.
- **Coarse pointer** (tablets, touch laptops, phones): 44px, the strip's touch target, with the same 26px halo.
- **Every width** (1366, 1470 and 375px checked, ticket 0922): the label is at most as wide as the screen leaves it, from the ring's left edge to 8px short of the screen's right edge (on any device at most 32rem); if the count wouldn't fit, only "Save Project file" shows (the count wraps onto a hidden second line). Under 1024px the strip's buttons drop their words, so the ring sits right after the Project icon.

## Copy

English, with the other languages in `writing.md` (Save reminder copy): Save Project file · {count} beads since the last file (one: {count} bead since the last file) · The browser keeps your work but can clear it. A Project file stays. · Beads since last file: {count} · Last file: {when} · No Project file yet · Beads since last file: {count}. Save a Project file to keep them. · Saved: {file} · Save Project file as…. "Save a copy" is gone (ticket 0859): a copy is what Duplicate makes.

Built in ticket 0796, moved to the strip in ticket 0922: `src/components/canvas/SaveReminder.vue` (in `CanvasStrip.vue`), its timing in `useSaveReminder`, the count in `useBeadsSinceFile` and `domain/beadsSinceFile.ts`, Save and Save as in `useExportFlow`.

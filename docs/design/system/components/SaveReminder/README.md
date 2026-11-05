# SaveReminder

A quiet reminder to save the open Project's Project file on the device: a round save button that appears at the drawing area's top-right once enough has been drawn since the last file (ticket 0796). Picked from five forms and five places on the design canvas "Save reminders" (form E, Ring; place 3, Canvas top right): https://claude.ai/artifact/MJPo9Q8YKiNsbDDGYV3YTC. The canvas shows the ring filling from the first bead, but it was then decided that nothing shows before the threshold. This card wins.

## Why it exists

Every Project lives in the browser's own storage (ADR 0001, ADR 0012), and a browser can clear that storage: when the disk runs short, after 7 days without a visit (Safari), or through Clear site data. A Project file (`.openbeads`) on the device is the copy the browser can't clear. The ring never warns or blocks: it appears when the file is well behind and saves it with one press. Nothing in its copy says "lost" or "deleted".

## Beads since last file

- **What counts:** for each Project, the bead positions that drawing changes since its Project file was last saved on this device: Paint, Fill, Eraser, Paste, the Mirror's copies and Clear all beads. A Fill that changes 300 beads counts 300, and painting a bead then erasing it counts 2.
- **What doesn't count:** changing a layer's Technique or Bead (Replace bead). Also excluded are moving the Frame or the reference image, Rotate canvas, Row progress, renames and settings. As built (ticket 0796), an Edit that moves, resizes or turns the Frame (Rotate Frame included) counts nothing on the Frame, since its beads are counted from its own corner; the Canvas's beads it changes still count.
- **Undo** takes off the count its Edit added and **Redo** puts it back. The count never goes below 0.
- **What resets it to 0:** any Project file save of this Project: Save or Save as (from the ring, the Project panel or the keys), Export all in the Menu (it writes every Project), or the Export in the notice row about a Project that didn't open (ticket 0716). PNG and PDF don't reset it.
- **Where it starts:** a new Project counts from its first bead. An imported Project starts at 0, since it came from a file. A duplicate starts with its original's count and last-file time.
- **Where it is kept:** with the Project on the device, beside its library entry, so a reload keeps it. It is never written into the Project file. As built: the localStorage key `openbeads:since-file`, one record per Project id (`beads`, `lastFileAt`), which older builds never read; Delete, Delete all and the start-up sweep drop a record.
- **Threshold:** 50 beads. If the browser has granted persistent storage (`navigator.storage.persisted()`, ticket 399), it is 100: storage pressure can't clear the library then, though Clear site data still can.

## The ring

- **Shown** with a Project open once Beads since last file reaches the threshold. It stays until the Project file is saved, and the count going back to 0 hides it. It is hidden below the threshold, with no Project open, on the Homepage and in Convert image.
- **Place:** the drawing area's top-right corner, `--save-ring-inset` in from the right and under the Canvas strip (16px, 8px on a phone), where short toasts used to start (Message card). While the ring shows, the toast layer starts 8px under it, so a toast never covers it. The ring stays put when the canvas pans, zooms or turns.
- **Material:** the Tool pill's: `elevated` fill, a 1px `line` edge, `radius-full`, no shadow in dark (`elevation-2` in light). It is 40px across (`--save-ring-size`): the 1px edge, 4px of padding, then a 30px halo (`--save-ring-halo`).
- **Halo:** a full circle of radius 13 in a 30px box, stroke `--save-ring-stroke` (2px), in `accent-strong`. The `save` icon (the floppy disk) sits in it at 16px, also `accent-strong`. There is no partial arc: the ring only exists once the file is behind.
- **Appearing:** it scales from 0.6 and fades in over `--duration-slow`, with `--ease-standard`. Under reduced motion it only fades.
- **Hover** adds `--hover-fill` over the `elevated` fill. **Pressed** adds `--press-fill` and the usual slight shrink. **Focus** is the 2px `focus-ring` (3px in High contrast).
- **High contrast:** the halo and the icon are `ink`, and the edge is 2px `line-strong`.
- **Stacking:** `z-chrome` (20). That puts it over the beads, the Frame, the margin sheet and the rulers, under the Selection bar (`z-context-bar`), the strip's panels (`z-popover`), toasts and dialogs. The Export panel hangs from the strip's right corner and covers it while open.

## The label

- **When it opens:** as the ring appears, then again at every further 100 beads (150, 250, … with the 50 threshold), and once when a Project opens with its count at the threshold or above and its last file (or creation, if it never had one) 7 or more days ago.
- **Never mid-stroke:** the ring's appearance and every opening wait until no stroke, Fill or paste has landed for 3 s, and until no panel, sheet, dialog or Adjust is open.
- **What opens:** the button widens leftwards, its right edge staying put: the halo first, then the label "Save a copy" (`tab`, 13/18 500, `ink`), then the count "+{count}" (`meta-small`, `muted`), with padding 0 12 0 4 after the halo. The width animates over `--duration-slow` with `--ease-standard`. Under reduced motion the label fades in place, with no width animation.
- **How long:** 4 s (`--save-ring-label-time`), then it closes back to the ring. It stays open while hovered or focused and closes 1 s after the pointer or focus leaves.
- There is no "Later" and no ×: the ring is already the quiet form, and closing the label is the "later".
- **Screen readers:** a polite live region says "Beads since last file: {count}. Save a copy to keep them." once each time the label opens.

## Press: Save

- **One action, any trigger.** A press runs **Save**, the Project file action that Save Project file in the Project panel and Ctrl/Cmd+S also run (ADR 0090). The ring adds no save path of its own, and the save-failed notice's Export runs Save too. **Save as** is the sibling action: Save Project file as… in the Project panel, or Ctrl/Cmd+Shift+S. The ring never runs it.
- **Linked file** (where the browser can write to a picked file, ADR 0090: Chrome, Edge and other Chromium browsers on desktop): a Project's first Save opens the system Save dialog, suggesting `{Project name}.openbeads`, and the file picked becomes the Project's Linked file. Every later Save writes into it with no dialog. If the browser has dropped its permission, the press asks again with the browser's own prompt. If that is refused, or the file was moved or deleted, Save opens the Save dialog and links the file picked, with no error. Save as always opens the dialog and links the new file.
- **Elsewhere** (Safari, Firefox, iPhone and iPad): there is no Linked file. Every Save is a new download or share sheet, as before, and Save as is hidden.
- **Feedback:** writing into the Linked file, or into a file picked in the dialog, shows the short toast "Saved: {file}" (`success`, 5 s, Message card). A download keeps the existing "File ready". Either way it shows in the corner the ring just left. If the dialog won't open or the write fails, Save hands the file over as a download instead, with "File ready" and no error.
- Once the file is written or the download handed over, the count goes to 0 and the ring hides. A cancelled dialog changes nothing. A refused download keeps the count and shows the action's existing error toast.

## Tooltip

The Menu card's Tooltip, under the ring, right edges aligned (the Tooltip's `align: end`), its meta lines being the Tooltip's `meta`:
- **Name:** "Save a copy", with the key chip `Ctrl/Cmd+S` (the control registry's chord for Save).
- **Body:** "The browser keeps your work but can clear it. A Project file stays."
- **Meta lines** (`meta-tiny`, `tooltip-muted`): "Beads since last file: {count}", then "Last file: {when}", or "No Project file yet" if it never had one. `{when}` uses `Intl.RelativeTimeFormat` with `numeric: "auto"` (today, yesterday, 2 days ago) in the app's language.

## Keyboard and accessible name

- A `button` named "Save a copy", with `aria-describedby` pointing at the count line, so the count is read with the name ("Save a copy, Beads since last file: 64"). This avoids a plural inside a sentence.
- In the tab order it comes after the Canvas strip's controls and before the drawing area. Enter or Space runs Save.
- Ctrl/Cmd+S (Save) and Ctrl/Cmd+Shift+S (Save as) work with a Project open, whether or not the ring shows, and never fall through to the browser's Save page: they are claimed from a text field, under an open panel or dialog (where they run nothing) and with no Project open (where they do nothing). Where Save as is hidden, Ctrl/Cmd+Shift+S runs Save.

## Sizes

- **Desktop** (1024px and up, fine pointer): 40px, inset 16px, as above.
- **Coarse pointer** (tablets, touch laptops): 44px (`--save-ring-size-touch`): the 1px edge, 6px of padding, then the same 30px halo. Inset 16px.
- **Phone** (under 744px): 44px, inset 8px (`--save-ring-inset-phone`). The label opens leftwards as on desktop and is at most the drawing area's width minus 16px; if the count wouldn't fit, only "Save a copy" shows (the count wraps onto a hidden second line). Toasts start 8px under the ring, as on desktop.

## Copy

English, with the other languages in `writing.md` (Save reminder copy): Save a copy · The browser keeps your work but can clear it. A Project file stays. · Beads since last file: {count} · Last file: {when} · No Project file yet · Beads since last file: {count}. Save a copy to keep them. · Saved: {file} · Save Project file · Save Project file as….

Built in ticket 0796: `src/components/canvas/SaveReminder.vue`, its timing in `useSaveReminder`, the count in `useBeadsSinceFile` and `domain/beadsSinceFile.ts`, Save and Save as in `useExportFlow`.

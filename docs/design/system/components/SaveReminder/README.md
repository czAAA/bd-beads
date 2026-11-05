# SaveReminder

A quiet reminder to keep a Project file of the open Project on the device: a round save button whose ring fills as work is added that isn't in a file yet. It floats at the drawing area's top-right corner (ticket 0796). Picked from five forms and five places on the design canvas "Save reminders" (form E, Ring; place 3, Canvas top right): https://claude.ai/artifact/MJPo9Q8YKiNsbDDGYV3YTC.

## Why it exists

Every Project lives in the browser's own storage (ADR 0001, ADR 0012), and a browser can clear that storage: when the disk runs short, after 7 days without a visit (Safari), or through Clear site data. A Project file (`.openbeads`) saved to the device is the copy the browser can't clear. The ring never warns or blocks. It shows how much work isn't in a file yet and saves one with a single press. Nothing in its copy says "lost" or "deleted".

## Beads since last file

- **What counts:** for each Project, every bead position whose stored value a command changes since the Project file was last saved on this device. That covers Paint, Fill, Eraser, Paste, the Mirror's copies, Clear all beads and Replace bead. A Fill that changes 300 beads counts 300. Moving the Frame or the reference image, Rotate canvas, Row progress, renames and settings don't count.
- **Undo** takes off the count its command added and **Redo** puts it back. The count never goes below 0.
- **What resets it to 0:** a Project file of this Project saved from anywhere: this ring, Project file in the Project panel, Export all in the Menu (it writes every Project), or the Export in the notice row about a Project that didn't open (ticket 0716). PNG and PDF don't reset it.
- **Where it starts:** a new Project counts from its first bead. An imported Project starts at 0, since it came from a file. A duplicate starts with its original's count and last-file time.
- **Where it is kept:** with the Project on the device, beside its library entry, so a reload keeps it. It is never written into the Project file.
- **Threshold:** 50 beads. If the browser has granted persistent storage (`navigator.storage.persisted()`, ticket 399), the threshold is 100: storage pressure can't clear the library then, though Clear site data still can.

## The ring

- **Place:** the drawing area's top-right corner, 16px in from the right and 16px under the Canvas strip, where short toasts used to start (Message card). While the ring shows, the toast layer starts under it (16px + 40px + 8px under the strip), so a toast never covers it. The ring stays put when the canvas pans, zooms or turns.
- **Shown** with a Project open, from the first changed bead (count 1 or more). **Hidden** at count 0, so right after a save, after an import, and on an empty new Project. It is also hidden on the Homepage and in Convert image, which have no open Project.
- **Material:** the Tool pill's: `elevated` fill, a 1px `line` edge, `radius-full`, no shadow in dark (`elevation-2` in light). It is 40px across (`--save-ring-size`): the 1px edge, 4px of padding, then a 30px halo (`--save-ring-halo`).
- **Halo:** two circles of radius 13 in a 30px box, stroke `--save-ring-stroke` (2px), round cap. The track is `line-strong`. The arc starts at 12 o'clock and runs clockwise over the share `min(count / threshold, 1)`. It is `muted` below the threshold and `accent-strong` from it. The arc animates its length over `--duration-slow`, with `--ease-standard`.
- **Icon:** `save` (the floppy disk) at 16px, centred: `body` below the threshold, `accent-strong` from it.
- **Hover** adds `--hover-fill` over the `elevated` fill. **Pressed** adds `--press-fill` and the usual slight shrink. **Focus** is the 2px `focus-ring` (3px in High contrast).
- **High contrast:** the arc and the icon are `ink` at every count, the edge is 2px `line-strong`, and the hover fill is unchanged.
- **Stacking:** `z-chrome` (20). That puts it over the beads, the Frame, the margin sheet and the rulers, under the Selection bar (`z-context-bar`), the strip's panels (`z-popover`), toasts and dialogs. The Export panel hangs from the strip's right corner and covers it while open, which is fine because it is a panel.

## The reminder: the label opens

- **When:** once the count first reaches the threshold since the last file, then again at every further 100 beads (150, 250, … with the 50 threshold), and once when a Project opens whose count is above 0 and whose last file (or creation, if it never had one) was 7 or more days ago.
- **Never mid-stroke:** it waits until no stroke, Fill or paste has landed for 3 s, and until no panel, sheet, dialog or Adjust is open. Then it opens.
- **What opens:** the button widens leftwards, its right edge staying 16px in: the halo first, then the label "Save a copy" (`tab`, 13/18 500, `ink`), then the count "+{count}" (`meta-small`, `muted`), with padding 0 12 0 4 after the halo. The width animates over `--duration-slow` with `--ease-standard`. Under reduced motion the label fades in place, with no width animation.
- **How long:** 4 s (`--save-ring-label-time`), then it closes back to the ring. It stays open while hovered or focused and closes 1 s after the pointer or focus leaves.
- There is no "Later" and no ×: the ring is already the quiet form, and closing the label is the "later".
- **Screen readers:** a polite live region says "Beads since last file: {count}. Save a copy to keep them." once each time the label opens. Nothing is announced as the arc fills.

## Press: the same save as Project file

- **One action, two triggers.** A press runs the Project panel's Project file action (the `export-project-file` control: the same code, the same file name and contents, the same toasts). The ring adds no save path of its own; it is another button for that action, like a menu item and its key. Whatever the action does, both triggers do it.
- **Into the same file where the browser allows it** (ticket 0796): in browsers that can write to a file the person picked (the File System Access API's `showSaveFilePicker`: Chrome, Edge and other Chromium browsers on desktop), the first save of a Project opens the system Save dialog, suggesting `{Project name}.openbeads`. The picked file is remembered for that Project on this device, and every later save from either trigger writes into that same file, with no dialog. If the browser has dropped its permission (after a restart, unless the person allowed it on every visit), the press asks again with the browser's own prompt. If the person refuses, or the file was moved or deleted, the save falls back to the Save dialog. Elsewhere (Safari, Firefox, iPhone and iPad), each save is a new download or a share sheet, as today.
- **Feedback:** writing into the remembered file shows the short toast "Saved: {file}" (`accent` edge, 5 s, Message card). A download keeps the existing "File ready". Either way, in the corner the ring just left.
- The count goes to 0 and the ring hides once the file is written, or once the download is handed over. A cancelled dialog changes nothing. A refused one keeps the count and shows the action's existing error toast.
- Export all writes a library file. It never takes over a Project's remembered file, but it still resets every Project's count.

## Tooltip

The Menu card's Tooltip, under the ring, right edges aligned:
- **Name:** "Save a copy". No key chip: the action has no key. Ctrl/Cmd+S stays unbound, so the browser's own Save page shortcut isn't taken over (an open question for a later ticket).
- **Body:** "The browser keeps your work but can clear it. A Project file stays."
- **Meta lines** (`meta-tiny`, `tooltip-muted`): "Beads since last file: {count}", then "Last file: {when}", or "No Project file yet" if it never had one. `{when}` uses `Intl.RelativeTimeFormat` with `numeric: "auto"` (today, yesterday, 2 days ago) in the app's language.

## Keyboard and accessible name

- A `button` named "Save a copy", with `aria-describedby` pointing at the count line, so the count is read with the name ("Save a copy, Beads since last file: 64"). This avoids a plural inside a sentence.
- In the tab order it comes after the Canvas strip's controls and before the drawing area. Enter or Space saves.

## Sizes

- Designed for desktop (1024px and up). On a coarse pointer the button keeps its 40px look and its hit area grows to 44px.
- Phones and tablets are not designed yet: until they are, the ring shows the same at every size.

## Copy

English, with the other languages in `writing.md` (Save reminder copy): Save a copy · The browser keeps your work but can clear it. A Project file stays. · Beads since last file: {count} · Last file: {when} · No Project file yet · Beads since last file: {count}. Save a copy to keep them. · Saved: {file} (writing into the remembered file; a download keeps "File ready").

Hand-written from the Save reminders design canvas (ticket 0796); static rendition.

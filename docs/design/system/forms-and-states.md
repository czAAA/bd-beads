# Forms and states

How the app asks for input, and what every part shows when it is empty, waiting or has failed.

## Form controls

- Fields (TextField, NumberField, Select) are `field-height` (40px), taller than the 34px controls, because people type and read in them; form buttons on a phone are `field-height-phone` (48px).
- The label sits above the field in `control`, 6px away; "optional" goes right of the label in `meta-small`. Hints are 13/18 `muted`, under the field.
- Border: `field-line`. Focus: `ink` border plus the 2px `focus-ring`. Error: `danger` border and a 13px `danger` line with the warning icon, saying what to enter, not what went wrong ("Enter a height."). Disabled: `surface` fill, `faint` text, and the reason written under it in words: a disabled control shows no tooltip.
- NumberField keeps its unit inside, right-aligned in `meta`, and asks for the numeric keyboard on touch. Select is the native select, so phones and iPads show their own picker.
- Stepper is the − value + control on desktop; the phone uses the larger sheet stepper. At a limit its button turns `faint`.
- SegmentedControl is for two or three always-visible choices (Technique, Unit, Change from); the chosen one is `ink` with `canvas` text. It is one tab stop; arrow keys move between options. Labels wrap to two lines when they do not fit (Russian technique names); every segment keeps the same height.
- Switch for on/off, FileButton for files (its limits always written under it). The app has no checkboxes or radio buttons; add them to DESIGN.md first if a screen ever needs them.
- Primary actions in a form fill its width; Cancel is always on the left of Confirm and takes focus first in a confirmation.

## Empty

- Say what is missing and what to do next, in one line of `body` or `muted`, using the app's own sentences: "No Pattern open yet", "Nothing painted yet", "No Patterns saved yet", "Open a Pattern to see how many beads it needs".
- The canvas box keeps its frame and shows an empty board; panels keep their header and hide their expand button.

## Loading

- Nothing appears for waits under `loading-delay` (300ms).
- Unknown length: three beads in `accent` that swell in turn; they stand still with reduced motion. Known share: the 4px Progress bar track with `--track-fill`.
- The text says what is happening: "Opening Logo panel · 250×250", "Converting the picture · 62%".

## Errors and results

- An error stays beside what caused it: at the field (forms), beside the button (imports), in the save box (saving). Only save failures, which affect the whole library, use the notice row under the header, and they stay until a save succeeds.
- Every error offers the way out when there is one: Export Pattern when saving fails, Export Pattern when a Pattern is too large for a QR code.
- Results that need no action ("Patterns imported: 3", "Saved") are short and go by themselves.
- The QR code always sits on white with dark modules, in both themes, so scanners can read it.

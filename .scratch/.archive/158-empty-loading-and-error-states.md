# 158: Empty, loading and error states

**What to build:** Every place that can be empty, waiting or failing follows `forms-and-states.md`: the canvas box keeps its frame and an empty board with "No Pattern open yet"; panels keep their header and hide their expand button ("No Patterns saved yet", "Open a Pattern to see how many beads it needs"); waits longer than 300ms show the three accent beads or the progress track with a sentence saying what is happening; errors stay beside what caused them and offer the way out (Export Pattern when saving fails or a Pattern is too big for a QR code); results that need no action go by themselves.

**Blocked by:** 141, 146, 147, 148

**Status:** done

- [x] Matches the EmptyCanvas, EmptyPanels, Loading, SaveStates and ImportResult cards
- [x] Nothing appears for waits under `loading-delay`; the loading beads stand still with reduced motion
- [x] Save failures use the notice row under the header and stay until a save succeeds; every other error stays beside its cause
- [x] Wording follows the sentence patterns in `writing.md`, in English and Russian
- [x] The QR code sits on white with dark modules in every theme
- [x] Correct in the light, dark and high contrast themes
- [x] Tests cover the empty, loading and failed states

**Done (ticket 158):** EmptyCanvas keeps the canvas box and its strip, with a small empty board (`board` and `bead-empty`, no word or curve), "No Pattern open yet" and the card's line on what to do; the Progress bar stays hidden. The panels' empty states came with tickets 146 and 147. LoadingState shows nothing before `--loading-delay`, then three accent beads (still under reduced motion) or the progress track, with a "Doing what · to what" line; it appears while a PNG or PDF is drawn ("Making the PDF · Fox", in the save box) and while a chosen picture is read. The app has no other wait long enough to need one: opening a Pattern and the conversion itself are synchronous. The save failure stays in the notice row until a save succeeds, now with Export Pattern (or the whole library, with none open) as its way out, and a Pattern too large for a QR code offers Export Pattern under the reason in the Export menu. Import and conversion errors stay beside their controls, and results go by themselves (the Saved toast; import results go with the next action, as the ImportResult card says). The save failure's own sentence still carries an em dash: ticket 165's copy audit rewrites it. The QR code sits on white with dark modules in every theme (QrCode draws it so).

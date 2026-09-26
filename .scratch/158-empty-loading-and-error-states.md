# 158: Empty, loading and error states

**What to build:** Every place that can be empty, waiting or failing follows `forms-and-states.md`: the canvas box keeps its frame and an empty board with "No Pattern open yet"; panels keep their header and hide their expand button ("No Patterns saved yet", "Open a Pattern to see how many beads it needs"); waits longer than 300ms show the three accent beads or the progress track with a sentence saying what is happening; errors stay beside what caused them and offer the way out (Export Pattern when saving fails or a Pattern is too big for a QR code); results that need no action go by themselves.

**Blocked by:** 141, 146, 147, 148

**Status:** ready-for-agent

- [ ] Matches the EmptyCanvas, EmptyPanels, Loading, SaveStates and ImportResult cards
- [ ] Nothing appears for waits under `loading-delay`; the loading beads stand still with reduced motion
- [ ] Save failures use the notice row under the header and stay until a save succeeds; every other error stays beside its cause
- [ ] Wording follows the sentence patterns in `writing.md`, in English and Russian
- [ ] The QR code sits on white with dark modules in every theme
- [ ] Correct in the light, dark and high contrast themes
- [ ] Tests cover the empty, loading and failed states

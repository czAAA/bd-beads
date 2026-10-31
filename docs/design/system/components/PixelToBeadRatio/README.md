# PixelToBeadRatio (retired)

Retired in ticket 0747. Convert image no longer sizes a Schema by a Pixel to bead ratio: its Size section is one Width slider (ConvertImage card, ValueSlider card), whose marks give the same exact pixel grid ("1 bead = 8 × 8 px"). The result line this card used to describe is now in the ConvertImage card's Size section.

The card stays only so links to it still land. Its values (`--ratio-chip-min`, `--ratio-bead-width`, `--ratio-bead-height`) go from `bundle.css` and `src/styles/design-values.css` with ticket 0747's build, once the code stops using them.

Was: presets 1:4, 1:2, 1:1, 2:1, 4:1, 8:1 and Custom as chips, a drawn explainer and the shared result line (ticket 0646, spec 0645).

# 211: New Pattern size inputs: placeholder clears on focus, numeric only

**What to build:** In the New Pattern form, the width and height inputs hide their placeholder as soon as the person focuses, clicks into or types in them, and show it again if the input is left empty. Both inputs accept digits only: letters, signs and decimal points are rejected whether typed or pasted, and touch devices show a numeric keypad.

**Blocked by:** None (can start immediately)

**Status:** done

**Overview / Tour:** asked; not added to either (small polish change).

- [x] Focusing or clicking into the width or height input hides its placeholder; typing keeps it hidden
- [x] Leaving an input empty brings its placeholder back on blur
- [x] Typing or pasting anything other than digits into either input is rejected (letters, `-`, `+`, `.`, `,`, `e`)
- [x] Touch devices show a numeric keypad for both inputs
- [x] Existing size validation and Pattern creation still work
- [x] Correct in the light, dark and high contrast themes

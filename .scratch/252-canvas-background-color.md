# 252: Canvas color: the person picks the background of the drawing area

**What to build:** The drawing area has one background, chosen by the person from a Canvas color button in the canvas strip, as the design system's CanvasBackground card describes (v16). Five backgrounds in light, six in dark; the Pattern sits directly on the chosen color, with no second fill for a board. The choice is remembered on the device like the theme, and exports always print on the light export board.

Backgrounds (design system names; tokens `canvas-bg-1` to `canvas-bg-6`):
- **Light:** Studio (default, equals the canvas box fill so nothing shifts), Linen, Sage, Mist, Blush.
- **Dark:** Night (default), Ink, Midnight, Olive, Umber, Ash (the lightest dark one).

**One choice, two palettes:** the app stores the number, not the color, so switching theme keeps the position (Sage 3 becomes Midnight 3). Light has no choice 6: a stored 6 shows Studio there and comes back with the dark theme. High contrast shows white for all of them and hides the control.

**Picker:** a popover under the Canvas color button: label "canvas color", a row of swatches, the current name and hex beneath. The chosen swatch has a 2px ring outside it and a check mark, so the choice is never shown by color alone. It is a radio group: Tab lands on the chosen swatch, arrows move and apply at once, Escape or an outside click closes and returns focus to the button. Each swatch is named "Sage, 3 of 5" (of 6 in dark). Coarse pointers get 40px swatches and a 44px button.

**Ash needs extra care:** rulers use `#a0a0a0`, empty beads `#3d3b38`, the technique word `#353432`, and beads get a 16% white rim so a black bead stays visible. Everywhere else rulers stay at least 4.8:1 and the row marker at least 13:1.

**Placement:** on desktop and iPad mini the strip holds the button. The phone has no strip, so the picker opens from the Pattern sheet's header row beside the zoom control; the design system marks this placement as proposed, not signed off, so confirm it with the user before building the phone part.

**Blocked by:** 233 (open canvas and Frame): it brings in design system v16, which holds the CanvasBackground card, the `canvas-bg-*` tokens and the Canvas color names, and it removes the board so the background is the only fill. Do not start until v16 is in `docs/design/system/`; this ticket does not edit it by hand.

**Status:** ready-for-agent

- [ ] A Canvas color button in the canvas strip (name "Canvas color", `aria-haspopup`, `aria-expanded`, a round dot showing the current color with a visible ring) opens the picker; uses the design system's icon and tokens only
- [ ] Light offers five swatches, dark six; choosing one recolors the whole drawing area (rulers, technique word, curve, beads on it) at once, and the strip, Progress bar and panels keep their own fills
- [ ] The default in each theme (Studio, Night) looks exactly like today: no visible change until a person chooses
- [ ] The choice is stored as a number on the device, survives a reload, and is kept when the theme changes; a stored 6 under light shows Studio and returns under dark
- [ ] The canvas renderer takes its background, empty-bead, ruler, word and rim colors from the per-theme `PatternTheme` for the chosen background, including the Ash overrides above
- [ ] Rulers meet 4.8:1 and the row marker 13:1 on all eleven backgrounds (a test or audit script checks the pairs)
- [ ] High contrast: the control is hidden and the drawing area stays white
- [ ] PNG and PDF exports ignore the choice and print on `print-board`; a test pins this
- [ ] Picker keyboard behaviour: Tab to the chosen swatch, arrows move and apply, Escape and outside click close and return focus; swatches named "{name}, {n} of {count}"
- [ ] Coarse pointers get 40px swatches and a 44px button
- [ ] Phone: the picker opens from the Pattern sheet's header row (after the placement is confirmed with the user)
- [ ] Copy in English and Russian from the design system's Writing section ("Canvas color" / "Цвет холста" and the eleven names); flag any Russian that reads wrong
- [ ] Correct in light, dark and high contrast themes; visual tests cover the picker open and one non-default background per theme (Linen in light, Ash in dark)
- [ ] CONTEXT.md gains a Canvas color term (the person's chosen background, a device preference, not saved with a Pattern, not in exports); ADR only if saving it per Pattern or per device is contested
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no Overview tile; Tour not yet decided, ask again before building

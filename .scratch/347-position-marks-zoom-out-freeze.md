# 347: Spec: Position marks without the zoom-out freeze

**Status:** ready-for-agent

**Tickets:** 347 itself fixes the freeze (the acceptance list at the end). 348 adds the Squares style. 349 is the tiled bitmap cache, written up for later.

## Problem Statement

A maker with a Project of about 150 × 30 beads zooms the canvas out to 20% (or further, down to the 10% Zoom floor), and the app freezes: every step of the wheel or pinch stalls, both on an iPad Air 13" and on a fast desktop PC.

The piece itself is not the cause. Zoomed out, the Open canvas around it shows tens of thousands of empty positions (about 85,000 at 20% and 355,000 at 10% on a desktop-sized canvas box), and today each one is drawn as its own dot, all collected into one path of circles and filled again on every wheel event. The cost grows with the square of how far out the maker zooms, not with how much they have drawn. Every zoom or scroll event also redraws at once, so a fast pinch pays that cost many times per frame.

Separately, makers have only one way to see the Grid's empty positions: small dots. Some would rather see each position as an outlined square they can aim a bead into.

## Solution

Zooming and moving around stays smooth at every zoom down to the Zoom floor, whatever the size of the canvas box. Position marks (the dots for empty positions outside the Frame) are drawn as one repeating tile rather than one shape per position, only the beads actually in view are drawn, and the canvas redraws at most once per animation frame. Nothing looks different.

Then (348) the maker can pick how Position marks look, as a preference on their device: **Dots** (today's look, the default) or **Squares** (an outline in the gap round each position, clear inside so the Canvas color shows through, shaped like the Technique's bead). The choice sits in the Canvas color popover, under the swatches; in high contrast the Canvas color button comes back and opens the toggle alone.

## User Stories

1. As a maker, I want to zoom out to 20% on a 150 × 30 Project without the app freezing, so that I can see my whole piece and its surroundings.
2. As a maker, I want to zoom out to the 10% Zoom floor smoothly, so that the Zoom floor is usable rather than a trap.
3. As a maker on an iPad, I want two-finger pinch zooming to follow my fingers without stalls, so that the canvas feels like a physical surface.
4. As a maker on a desktop, I want Ctrl/⌘ + wheel zooming to stay smooth even with a fast trackpad that sends many events per second, so that zooming isn't jerky.
5. As a maker, I want moving around a zoomed-out canvas with the Hand tool, the wheel, two fingers or Space + drag to stay smooth, so that I can find my way across the Open canvas.
6. As a maker, I want the cost of zooming out to depend on what I've drawn, not on how much empty canvas is in view, so that a larger screen or a bigger canvas box doesn't make the app slower.
7. As a maker, I want the canvas to look exactly as it does today after the speed fix, so that nothing I'm used to changes.
8. As a maker, I want the keep-out margin round my Frame to stay a gap with no Position marks, so that I can still see where I can't draw.
9. As a maker, I want empty positions inside the Frame to stay empty beads, so that the Pattern stands out from the canvas round it.
10. As a maker using brick stitch or peyote, I want Position marks on alternate rows shifted by half a bead, as today, so that the marks line up with where beads will land.
11. As a maker who has rotated a Project, I want Position marks to line up with the beads at every quarter turn, so that rotation doesn't break the canvas.
12. As a maker, I want beads drawn outside the Frame to cover their Position mark completely, so that marks never show through a painted bead.
13. As a maker, I want edits (Paint, Erase, Fill, Paste) to redraw as quickly as they do today, so that the speed fix doesn't slow down drawing.
14. As a maker, I want finished rows under Row progress to fade as they do today, so that the lock still reads at a glance.
15. As a maker, I want my exports to be unchanged, with no Position marks in them, so that the PNG, PDF and QR stay clean.
16. As a maker, I want to choose between Dots and Squares for Position marks, so that I can see the Grid the way that suits me.
17. As a maker, I want Squares to show an outline in the gap round each empty position, clear inside, so that the Canvas color still shows through.
18. As a maker using peyote, I want Squares to have the same rounded corners as peyote beads, so that a painted bead lands exactly inside its square.
19. As a maker using brick stitch or peyote, I want Squares on alternate rows offset by half a bead, so that the outlines follow the Technique's Grid.
20. As a maker, I want the Dots | Squares toggle in the Canvas color popover, under the swatches, so that everything about how the canvas looks is in one place.
21. As a maker on a phone, I want the toggle wherever Canvas color sits in the Menu sheet, so that I can choose it under 1024px too.
22. As a maker using high contrast, I want the Canvas color button back, opening the Dots | Squares toggle alone, so that I can choose Squares, which may read more clearly than small dots.
23. As a maker, I want my choice applied at once, without closing the popover, so that I can compare the two looks.
24. As a maker, I want my choice kept on this device across reloads, so that I don't have to choose again.
25. As a maker with an iPad and a PC, I want each device to keep its own choice, so that I can use Squares on one and Dots on the other.
26. As a maker sharing a Project, I want my Position marks choice not to be saved with the Project, so that the person I share it with sees their own preference.
27. As a maker, I want Dots to stay the default, so that nothing changes until I choose otherwise.
28. As a maker, I want the toggle's two options to have a dot icon and a square icon with "Dots" and "Squares" labels and Tooltips, so that I know what each one does before I press it.
29. As a keyboard user, I want to reach and change the toggle with the keyboard, so that it is as accessible as the swatches.
30. As a maker, I want Dots and Squares to use the same colour in each theme, so that they feel like two forms of the same thing.
31. As a maker zoomed far out with Squares on, I want the outlines kept at every zoom, so that the look is predictable (a switch-over zoom may come later as a design decision).
32. As a maker with a Project far bigger than 150 × 30 (there is no size limit), I want zooming and moving to stay smooth in future too, so that large patterns stay workable (349).

## Implementation Decisions

**Vocabulary.** `CONTEXT.md` now defines **Grid** (the endless arrangement of positions on the Open canvas set by the Technique) and **Position marks** (how the Grid's empty positions outside the Frame and its keep-out margin are drawn, in the style **Dots** or **Squares**). Code names follow: `positionMarks: 'dots' | 'squares'`.

**Position marks stay inside the Project renderer** (ADR 0018 holds; no new ADR). They are not a CSS background: a canvas pattern keeps them aligned with the beads to the pixel at every zoom and rotation, with no second drawing system to keep in step.

**Project renderer, open canvas only:**
- Position marks are drawn by one pattern fill over the visible region: a tile one bead across and two rows down (so the alternate rows of brick and peyote carry their half-bead shift), made at the size it is on screen in device pixels and kept like the bead sprites. The tile is built by a function that takes the style, so Dots and Squares are two tiles behind one fill.
- The pattern's transform follows the grid transform (zoom, rotation, scroll), so it lines up with the beads at every quarter turn.
- The Frame and its keep-out margin are kept free of marks by clearing (or not filling) those rectangles, not by testing each position.
- The per-position loop goes. Two passes draw what's left: the Frame's cells within view (bead or empty bead, as today), and the painted beads within view read from the sparse bead map (only stored rows in the visible row range, and only their stored columns).
- Drawing only the changed rows after an edit keeps working, with the same clearing and drawing in its band.
- Frame-only drawing (exports, the Convert image preview, the Overview) has no Position marks and is unchanged.

**Drawing surface:** zoom, scroll, size and Project changes only ask for a redraw; the base layer and the overlay each draw at most once per animation frame, with what's current then. Tests and environments without animation frames still draw.

**Theme and tokens (348):** a new role token `position-mark`, starting from `bead-empty`'s values in light, dark and high contrast, used by both styles. Squares are a 1 CSS px outline in the 1px gap round each position, with the Technique's bead corner radius.

**Device preference (348):** stored next to Canvas color in the device preferences, defaulting to Dots, never saved with a Project, never in exports.

**Canvas color popover (348):** gains a two-option Dots | Squares segmented control under the swatches, made from the shared controls and the control registry (ADR 0035), with no keyboard shortcut. In high contrast the button is shown and the popover holds the toggle alone. On the phone it goes wherever Canvas color sits in the Menu sheet.

**Design system (348):** in the same commit, the BeadBoard card README (Position marks, both styles), the Canvas color card, `tokens.json`, `bundle.css`, the app's design-values stylesheet, and a Version changelog line (`DESIGN.md` §6).

## Testing Decisions

A good test here says what was drawn or what the maker can do, not how: counts and positions of drawing calls on a recording context, or what a mounted component shows and stores. No test reads a private helper or relies on the order of internal calls beyond what decides the picture (marks first, then beads over them).

- **Project renderer with the recording context** (main seam; prior art: the space tests of the renderer and the recording context in the test utilities). The recording context gains `createPattern` and `drawImage`.
  - At the Zoom floor and at 100%, the Position marks take a constant number of fills, the same at both zooms.
  - Beads drawn equal the Frame's cells in view plus the painted beads in view, for loom, peyote and brick, at 0°, 90°, 180° and 270°.
  - Nothing is filled with marks inside the Frame or its keep-out margin.
  - The changed-rows redraw still clears and redraws only its band.
  - Frame-only space draws no marks (the existing "open canvas is dotted outside the Frame" test is reworded to the pattern fill).
  - (348) The Squares tile is an outline with the Technique's corner radius; the Dots tile is today's dot.
- **Drawing surface mounted with a fake animation frame** (prior art: the surface's own component tests and the fake canvas). Several zoom and scroll changes before a frame lead to one redraw of each layer, with the last values.
- **Canvas color popover mounted** (348; prior art: its own component tests). Choosing Squares applies at once and is stored; a reload reads it back; high contrast shows the button with the toggle alone (the current "is hidden in high contrast" test flips).
- The visual tests should not change for 347. For 348 only the new Squares baselines are added.
- Run only the related tests locally (`npx vitest related --run`); CI is the gate.

## Out of Scope

- Changing how Dots look at any zoom, including thinning or hiding them when zoomed far out (a separate design decision once Squares has been seen).
- A zoom at which Squares switch to Dots.
- The tiled bitmap cache and moving drawing off the main thread (349).
- WebGL rendering.
- Ruler dots, the rulers and the overlay's own drawing, beyond redrawing at most once per frame.
- Renaming the loose uses of "grid" in `CONTEXT.md` that mean the beads or the Pattern; they get reworded when someone next edits those entries.

## Further Notes

- The freeze was reported on an iPad Air 13" and on a Ryzen 5 desktop with 32 GB RAM, so it is the drawing work, not the device.
- The maker checks 347 and 348 by hand on both devices, alongside the drawing-call count tests.
- ADR 0019 (no size limit) is why 349 exists: after 347 the cost follows the beads in view, which is fine for 150 × 30 but not for a very large piece at the Zoom floor.

## Acceptance (347: the freeze fix)

- [ ] Position marks are one pattern fill on the open canvas; no per-position shapes are drawn
- [ ] Only the Frame's cells and the painted beads in view are visited and drawn
- [ ] The keep-out margin and the Frame are free of marks; empty Frame cells are still empty beads
- [ ] Base layer and overlay redraw at most once per animation frame
- [ ] The renderer and surface tests above pass; the visual tests are unchanged
- [ ] Hand check: zooming out to 20% and 10% with a 150 × 30 Project is smooth on the iPad Air 13" and the desktop PC

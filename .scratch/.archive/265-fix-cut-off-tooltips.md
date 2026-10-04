# 265: Fix the Tooltips that are cut off

**What to build:** Every Tooltip opens whole: nothing in it is cut off by the column, the canvas, the drawing area, a bottom sheet or the app shell that holds its button, nothing hangs past any edge of the screen, and its text is never a long single strip. This holds in English and Russian at every width from 320 to 1900 px, in every state the app has. The pending entries ticket 264 listed are deleted, so the check is strict for hover text.

Fix the causes, not the places (see Findings). In short: the bubble must not be clipped by any ancestor (show it outside the clipping ancestors, on the top layer), must choose the side that has room and stay inside the screen on every edge, and must have a sensible maximum width. The Tooltip keeps its look, tokens and behaviour (hover, focus, Escape, long-press on touch); the design system's Tooltip card stays the reference. If the design system doesn't cover the flipped or wrapped Tooltip, add it on claude.ai first (DESIGN.md §6).

## Findings (research, 2026-10-04)

Method: a throwaway browser probe (not committed) opened the Tooltip of every visible trigger by mouse hover, in English and Russian, at 1900, 1280, 1024, 768, 390, 360 and 320 px, in 17 states: the editor with Row progress on; every Tool group opened; the Select tool with a selection; the Frame tool with a drag; each of the 5 phone sheets; the drawer, and the drawer with its groups open; Saved Projects expanded; Beads needed expanded; the export menu; the Shortcuts help; the empty library; the New Project form. It found 1833 opened Tooltips (95 distinct triggers). For each it measured the bubble against the screen, against every ancestor that clips (the first one is named), and by hit-testing points inside the bubble to see how much of it is actually visible. 753 of the 1833 openings were cut or clipped at least a little; no bubble had text wider than its own box. So every defect is a clip or an off-screen position, none is a text-wrap problem.

### The three causes

1. **The bubble is a child of its trigger, so any clipping ancestor cuts it.** The clippers seen in the app are the left column, the canvas box, the drawing area, the bottom sheet and the app shell. No ancestor was a mistake in itself: each clips for a reason. The bubble is the thing that has to escape them.
2. **Its only guard is the screen, with an 8 px margin, and it never flips.** The nudge keeps the bubble inside the screen's left and right, but not inside the column or sheet that holds the button (a column starts further in than 8 px, so a bubble moved to 8 px is still cut), and not at all vertically. The placement (`bottom`, or `top` when asked) is fixed: a button near the bottom edge opens its Tooltip off-screen.
3. **No usable maximum width.** The bubble is `max-content` wide up to the screen's width less 16 px. Short ones are fine, but the New Project form's size-conversion note is 1218 px wide on one line at 1900 px, and the rich Toolbox bubble (name, shortcut, description) is 288 px, wider than the ~250 px column it opens in.

### What is cut, by place (all in English and Russian unless noted)

| Trigger | Where / widths (px) | What happens | Clipped by |
|---|---|---|---|
| Progress bar: Turn row direction | 320–1900 | only 25% of the bubble shows; also 14 px below the screen at 1024 | canvas box |
| Progress bar: Row not done / Row done (icon buttons, `previous-compact`, `next-compact`) | 320–1900 | 20–25% visible; at 1024 14 px below the screen | canvas box |
| Phone zoom pill: Rulers, Zoom out, Zoom in, Reset zoom to fit | 320, 360, 390 | 0% visible: the bubble is entirely clipped | drawing area |
| Desktop zoom buttons: Zoom in, Reset zoom to fit | 768–1900 (Russian also 1024) | 83% visible, the right end cut | canvas box |
| Toolbox: Paint, Fill, Set Frame, Hand, Select | 768–1900 (which of them depends on the width) | 83% visible; at 768–1024 Paint and Hand start at x=8 but the column starts further in. This is the user's screenshot (Hand, in the drawer) | left column |
| Tablet bottom toolbar: Paint, Fill, Select, Eraser, Hand | 768 | 0% visible: opens below the button, 8 px under the screen | app shell |
| Image colors button ("No image colors: this Project was not converted…", 433 px wide) | all widths; 768–1900 in the column, 320–390 in the Colors sheet | up to 66% cut; at 390 the bubble spans -8 to 382 | column, bottom sheet |
| Import file / Import QR code (compact) | 320, 360, 390: empty library and the Project sheet | 0–25% visible; 8 px below the screen | app shell, bottom sheet |
| Saved Projects sheet button (`phone-saved-projects-button`) | 320–390, Project sheet | 0% visible | bottom sheet |
| Saved Projects: the fixture Project's name | 1024 | right/left cut | left column |
| Copy button (Russian) | 1024–1900, with a selection | 83% visible | left column |
| New Project form: size-conversion info | 1900 (1218 px wide, `top`), 390 (spans -8 to 382) | 33% visible at 1900; clipped at 390 | left column, bottom sheet |

The Hand screenshot case reproduces: the Hand bubble is at x=8–243 at 768–1024 px while the left column clips at its own, further-in edge.

### What the probe did not reach (so the list above is a floor)

- Shortcuts help: only 1 of 28 tooltips in it opened.
- The Saved Projects and Beads needed expand buttons timed out twice, so these panels were probed in only some states.
- Steppers (`AppStepper`'s Tooltip) and Tooltips that open only on a disabled-then-enabled trigger were never seen.
- The Tour is switched off (ticket 247), so its Tooltips were not probed.
- Modals and the confirm dialogs were not hovered.
- Keyboard-focus and touch long-press openings use the same bubble, so only mouse hover was measured.

Ticket 264's reachability guard exists to close exactly this gap; run its check again after this ticket and trust it over this list.

### Hover text that is not a Tooltip

- **Native `title` attributes.** The browser draws these, so they can never be cut off, but they don't show on keyboard focus or touch and don't use the design system's Tooltip. At least 16 hover ones: Row not done / Row done in the Progress bar (2), the Mirror controls (7), Toolbox's Remove line, Clear and a locked-size reason (3), and the Context bar's Fit to drawing, Remove Frame and Rotate (4). (Another ~29 `title=` hits in the source are headings of boxes, modals and sheets, not hover text.) Out of scope here; ticket 264's source guard needs an exemption list for these, with the reason, until a separate ticket moves them onto the Tooltip.
- **Info popovers** (Beads needed weight, the size estimate in the Toolbox, the New Project estimate): click-open, hand-made, already covered by the text-fit check (ticket 229), and not flagged by the probe.

**Blocked by:** 264 (the check that proves it, and the pending list this ticket empties).

**Status:** done

- [ ] Every row of the table is fixed: its Tooltip shows whole in English and Russian at 320, 360, 390, 768, 1024, 1280 and 1900 px, including the Hand tooltip in the drawer from the user's screenshot and every Progress bar and zoom Tooltip
- [ ] No ancestor clips a Tooltip: a Tooltip placed in a new `overflow: hidden` box, anywhere in the app, still shows whole (proved in development, not committed)
- [ ] A Tooltip chooses the side that has room: a trigger at the bottom of the screen, a bottom sheet or the tablet toolbar opens it above, a trigger at the top opens it below, and it stays inside the screen on all four edges
- [ ] A Tooltip's width is capped at a design-system measure (the existing wide-tooltip width, or a token added on claude.ai first), and its text wraps inside it; no Tooltip is a strip wider than ~300 px, and the rich Toolbox bubble fits the column it opens from
- [ ] The Tooltip still opens on hover, keyboard focus and touch long-press, closes on leave, blur, Escape and release, and keeps its screen-reader behaviour (the existing unit tests pass)
- [ ] The info popovers are still whole
- [ ] All ticket 264 pending entries are deleted and the check passes strict; run the check again for states this list says were not reached, and fix what it then finds
- [ ] The look is unchanged where nothing was cut off: visual references that cover a Tooltip stay the same, or change only where a Tooltip moved
- [ ] CONTEXT.md's Tooltip entry says a Tooltip is never clipped, flips to the side with room and has a maximum width

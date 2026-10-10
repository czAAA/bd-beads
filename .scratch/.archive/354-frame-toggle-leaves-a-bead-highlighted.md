# 354: Turning Set Frame on or off no longer leaves a bead picked out

**What to build:** switching Set Frame on and off (the Frame tool, key 6, Enter or Escape, the dock or phone sheet) must not leave a bead looking selected or hovered on the canvas. Today a bead is lit up as a side effect of the switch, though nobody pointed at it.

Likely causes found while reading the code (confirm by reproducing first; there may be more than one):

- **Turning it off:** the keyboard bead cursor is hidden only while Set Frame runs (`cursorShown` is `keyboardOnProject && !settingFrame`). The keyboard path gives the Project focus, so when Set Frame ends the cursor reappears on whatever bead it last rested on, and nothing hovered it on purpose. Ending Set Frame should not reveal a cursor the person did not move.
- **Turning it on:** the hover preview of the bead under the pointer (or the cursor's bead) is not cleared when Set Frame starts. The surface stops hovering during Set Frame but keeps `lastBead` and never ends the hover, so the preview of the last hovered bead stays drawn through the mode. On leaving, the same stale `lastBead` can make the first move onto that bead emit no hover at all.

Expected: entering Set Frame clears any hover preview and the surface's remembered bead; leaving it brings back no cursor and no preview until the pointer or the keyboard actually moves. Pointer, keyboard (key 6, Escape, Enter) and touch routes all behave the same.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A failing test reproduces the stray bead (hover or keyboard cursor) after turning Set Frame on, and after turning it off
- [x] After hovering a bead with the mouse and then turning Set Frame on, no hover preview is drawn on the canvas
- [x] After turning Set Frame off (button, key 6, Enter, Escape), no hover preview and no keyboard bead cursor appears until the pointer or an arrow key moves
- [x] Moving the pointer onto the previously hovered bead after Set Frame ends shows its hover preview again
- [x] Set Frame itself (draw, move, resize, keyboard arrows) and tool painting are unchanged
- [x] The ticket is archived in the same change

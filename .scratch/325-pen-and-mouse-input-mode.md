# 325: Pen mode and Mouse mode: who draws and who moves the canvas

**What to build:** An input mode toggle that decides which pointer draws and which one moves the canvas, so a palm or finger resting on an iPad no longer paints while the Apple Pencil is in use.

- **Pen mode:** the pen draws with the current Tool; a finger or mouse drags the canvas, like the Hand tool.
- **Mouse mode:** a finger or mouse draws with the current Tool; the pen drags the canvas.
- Two-finger pinch-zoom and pan, the wheel and Space + drag work in both modes as today.
- The mode is told apart by the pointer type of each event, not by the active Tool, and holding Hand or Set Frame behaves as before for whichever pointer is allowed to act.

The toggle is one button showing the icons from ticket 324 (the active mode in the accent colour). On the phone layout it sits at the bottom-left of the Dock; on desktop and tablet it sits in the Toolbox right after the Frame tool. For now it shows on every touch-capable device; ticket 326 narrows that. The choice is remembered on the device. Default is Mouse mode.

It needs: a Tooltip and accessible name in English and Russian, an entry in CONTEXT.md (domain terms Pen mode, Mouse mode), tests for each pointer type in each mode, correct layout at all five screen sizes and in all themes, updated visual snapshots, and the text-fit and hover-reachability checks. The Overview and Tour question (CLAUDE.md): the Tour is off, so don't ask about it; ask whether the Overview needs a tile.

**Blocked by:** 324 (the two icons).

**Status:** ready-for-agent

- [ ] In Pen mode a pen stroke draws and a finger or mouse drag moves the canvas; one Undo step per stroke is unchanged
- [ ] In Mouse mode a finger or mouse stroke draws and a pen drag moves the canvas
- [ ] Pinch-zoom, wheel and Space + drag are unaffected in both modes
- [ ] The toggle shows the right icon and `aria-pressed`/label state for the current mode, with a Tooltip and EN/RU names
- [ ] Placed bottom-left of the Dock on phone and after the Frame tool in the Toolbox on desktop and tablet
- [ ] The chosen mode is restored after reload
- [ ] CONTEXT.md defines Pen mode and Mouse mode; the Overview tile question is asked of the user
- [ ] Tests and visual snapshots updated; text-fit and hover checks pass

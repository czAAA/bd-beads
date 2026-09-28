# 180: Empty canvas: full-bleed board

**What to build:** Update the design system's empty-canvas-board entry (per DESIGN.md's process: propose on claude.ai first, then copy into `docs/design/system/`) to specify a full-bleed board, then update `empty-canvas__board` to fill the entire canvas area instead of a small centered box, reversing #158's original choice.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Design system updated on claude.ai with the new full-bleed empty-canvas-board spec, then copied into `docs/design/system/`
- [ ] `empty-canvas__board` fills the full canvas box at every breakpoint
- [ ] No regression to the empty-canvas hint text/CTAs from #158

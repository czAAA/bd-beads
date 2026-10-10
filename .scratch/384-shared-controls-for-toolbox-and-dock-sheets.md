# 384: The Toolbox and the Dock sheets share their tool, colour and Edit controls

**What to build:** the tool buttons, the colour controls (palette, custom colour, Image colours) and the Edit controls (Undo, Redo, Rotate, Copy and so on) become shared components used by both the Toolbox and the Dock sheets, so a control is changed in one place. The sheets' arrangement does not change. Split out of ticket 383 (the Dock layout), which landed without it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Checklist

- [ ] Tool, colour and Edit controls shared by the Toolbox and the Dock sheets
- [ ] Only the Toolbox (and what only it uses) marked as an exception in `knip.jsonc` if it ever shows as unused
- [ ] Tests for the shared components on their own

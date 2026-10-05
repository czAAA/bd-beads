# 291: Pressing F leaves the previous tool lit beside the Frame tool

**What to build:** While Set Frame is on, the Frame tool shows as active, but the previously selected tool's tile also stays active. Set Frame is a mode, not a Tool, so `activeTool` is unchanged and `activeTool === tool.id` still lights that tile. While `settingFrame` is true, no tool tile other than Frame shows as active (look, `aria-pressed`, tab stop) in the Toolbox and in the iPad toolbar (BottomToolbar); check the phone Dock and ToolSheet for the same fault. Choosing a tool still ends Set Frame, and the previously selected tool is lit again afterwards, exactly as today. Only the display changes: no Tool state, no Undo, no key behaviour.

**Blocked by:** none (touches the same tiles as 292; either lands first)

**Human involvement:** autonomous

**Status:** ready-for-agent

- [ ] With a tool selected, pressing F (or the Frame tile) lights only the Frame tile in the Toolbox and the iPad toolbar; `aria-pressed` is true on Frame alone
- [ ] Leaving Set Frame (Escape, a tool tile, a tool key) lights the right tool again
- [ ] The Dock and ToolSheet show the same thing, or a note says they already did
- [ ] Regression tests in Toolbox/BottomToolbar tests and App.frame.test.ts

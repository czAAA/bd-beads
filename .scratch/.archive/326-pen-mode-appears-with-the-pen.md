# 326: Show the mode toggle only after a pen is seen, and enter Pen mode

**What to build:** Browsers cannot say whether a pencil exists until it touches the screen, so the input mode toggle (ticket 325) stays hidden until the first pen event of the session (a pointer event whose type is pen). That first pen touch reveals the toggle and switches to Pen mode, so a finger resting on the screen stops painting from then on. Devices that never see a pen (phones, mice) never show the toggle and behave as today.

If the person has already chosen a mode explicitly (it is remembered, ticket 325), a pen event reveals the toggle but does not change their choice. Once a pen has been seen on a device, the toggle stays visible on later visits.

**Blocked by:** 325 (the toggle and the two modes).

**Status:** done

- [x] With no pen event, the toggle is not rendered and mouse and finger behave exactly as before
- [x] The first pen event reveals the toggle and, if no mode was chosen explicitly, switches to Pen mode; the stroke that revealed it still draws
- [x] An explicitly chosen mode is never overridden by a pen event
- [x] "A pen has been seen" is remembered on the device, so the toggle is there on the next visit
- [x] The text-fit and hover-reachability checks cover the revealed state (a Screen that simulates a pen event), and tests cover the hidden state
- [x] CONTEXT.md notes when the toggle appears

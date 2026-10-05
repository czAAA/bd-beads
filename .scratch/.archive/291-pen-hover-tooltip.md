# 291: Tooltip on Apple Pencil hover

**What to build:** On an iPad, hovering an Apple Pencil over a control shows the same Tooltip a mouse hover shows, and it hides when the pencil moves away. A finger still has no hover (a tap opens nothing), and a long press with a finger or pen still opens the Tooltip, so iPads and pencils that can't hover keep working.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A pen `pointerenter` opens the Tooltip; leaving closes it
- [x] A touch `pointerenter` still opens nothing
- [x] Long-press with touch or pen still opens the Tooltip and hides on release
- [x] Unit test for pen hover
- [ ] Human: confirm on an iPad that supports Pencil hover (not testable here)

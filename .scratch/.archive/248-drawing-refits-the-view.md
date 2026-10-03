# 248: Drawing a bead moves the open canvas

**What to build:** Drawing a bead on the open canvas no longer moves the view. The view re-fit itself (re-centred on the beads) on every edit, because the watch on the Pattern's id and rotation used one getter returning a fresh array, which Vue treats as changed each time the Pattern object is replaced. It now watches the two values separately, so the view re-fits only when the Pattern or its rotation changes.

**Blocked by:** None

**Status:** done

- [x] Drawing a bead on a canvas with no Frame leaves the scroll and zoom where they were
- [x] A regression test in `useCanvasView.test.ts` fails without the fix
- [x] Overview and Tour question (CLAUDE.md): not asked, a fix and no new user-facing functionality

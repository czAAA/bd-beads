# 09: Row progress overlay

**What to build:** A toggle inside the Pattern editor that turns on a Row progress overlay: a sequential current-row pointer (advanceable and manually movable backward), with finished rows dimmed, the current row highlighted, and remaining rows shown normally. State persists with the Pattern.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A toggle shows/hides the row-progress overlay without leaving the normal editor
- [ ] The overlay shows one "current row" pointer, advancing as rows are marked done
- [ ] The pointer can be moved backward manually to an earlier row
- [ ] Rows before the pointer render dimmed/grey; the current row is distinctly highlighted; rows after render in normal Pattern colors
- [ ] Row-progress state persists to localStorage with the rest of the Pattern

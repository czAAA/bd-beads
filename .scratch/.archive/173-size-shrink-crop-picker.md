# 173: Size tool: pick what's kept when shrinking

**What to build:** When resizing to a smaller grid, let the user hover over the current pattern in the confirmation modal to choose which region is kept vs. cropped, rather than an implicit corner/edge crop.

**Blocked by:** 172 (Size tool cleanup — this builds on the consolidated confirmation modal)

**Status:** done

- [ ] Shrinking the grid shows a hover-preview over the current pattern indicating what will be kept
- [ ] The user can confirm a chosen crop region before applying the resize
- [ ] Growing the grid is unaffected (no crop picker needed)

# 185: Export: fixed 100×100-bead block chart pages

**What to build:** Change chart-page splitting (#163) from an auto-computed part size to fixed 100×100-bead blocks, one block per page.

**Blocked by:** 184 (Fix huge-pattern export first-page scaling regression — shares the same pagination sizing logic)

**Status:** ready-for-agent

- [ ] Chart pages split a pattern into 100×100-bead blocks (edge blocks sized to whatever remains)
- [ ] Each block renders on its own page
- [ ] Verified against both the previous auto-computed behavior's test fixtures and new large-pattern fixtures

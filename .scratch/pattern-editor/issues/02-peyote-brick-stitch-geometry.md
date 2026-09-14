# 02: Peyote and Brick stitch grid geometry

**What to build:** Extend Pattern creation so Peyote and Brick stitch can be chosen as the Technique, each rendering its own offset-row grid geometry instead of Loom's straight grid.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] User can choose Peyote or Brick stitch as the Technique when creating a Pattern, in addition to Loom
- [ ] Peyote patterns render rows offset by half a cell in alternating rows
- [ ] Brick stitch patterns render with a brick-style row offset, visually distinct from Peyote's
- [ ] Persistence/reload (from ticket 01) works identically for Peyote and Brick stitch patterns

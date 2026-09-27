# 184: Fix huge-pattern export first-page scaling regression

**What to build:** Fix exports of very large patterns so the first page always shows the full pattern scaled to fill the sheet, as originally specified in #162/#163, instead of a tiny centered image with wasted space.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Exporting a pattern large enough to previously reproduce the bug shows the full pattern filling page 1
- [ ] No excess empty space around the page-1 image
- [ ] Regression test/fixture added covering a large pattern size that previously failed

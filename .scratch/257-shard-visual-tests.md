# 257: Shard the visual tests

**What to build:** The visual check runs as a matrix of shards (start with 4) of Playwright's own sharding, each against the one shared build from 255, so the visual job lands around 1.5-2 min instead of 4.7 min. The reference screenshots stay one folder, the same on every shard. A failing shard uploads its own report, and the reports are merged into one HTML report so a failure is read in one place. One aggregate check ("visual check passed") depends on all shards and is what branch protection requires.

Also try more than one Playwright worker per runner (the runner has 2 vCPUs, and CI currently forces 1). Keep it only if the tests stay stable: the pixel comparisons must not become flaky under load. State the measured times for the worker and shard counts tried in the PR.

**Blocked by:** 255 (Run CI as parallel jobs). Uses the visual matrix as left by 253 if that has landed, but doesn't need to wait for it.

**Status:** ready-for-agent

**Overview / Tour:** not applicable (no user-facing change); recorded per CLAUDE.md.

- [ ] The visual job is a matrix of shards, and every visual test runs in exactly one shard (total count matches an unsharded run)
- [ ] Shards download the shared build instead of building it again
- [ ] A failing shard's report and screenshots are available, and the reports merge into one
- [ ] One aggregate check fails if any shard fails, and is the check branch protection requires
- [ ] The visual job's wall time on CI is 2 min or less, or the PR says what stops it getting there
- [ ] The visual run passes five times in a row with the chosen worker and shard counts (no new flakiness)
- [ ] Shard and worker counts are chosen from measured times, which are in the PR
- [ ] The whole pipeline's wall time on a green run is 5 min or less

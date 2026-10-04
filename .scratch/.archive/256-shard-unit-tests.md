# 256: Shard the unit tests

**What to build:** The unit job runs as a matrix of shards (start with 3) using Vitest's built-in sharding, each shard on its own runner with the install cached, so the unit job lands around 1.5-2 min. A single final check job ("unit tests passed") depends on all shards, so the branch protection names one stable check instead of one per shard.

Pick the shard count by measurement: more shards stop paying off once install and startup per shard (about 30s) outweigh the tests saved. State the measured times for 2, 3 and 4 shards in the PR and keep the cheapest one that meets the target.

**Blocked by:** 254 (Split the App test file by feature), 255 (Run CI as parallel jobs).

**Status:** done

**Overview / Tour:** not applicable (no user-facing change); recorded per CLAUDE.md.

- [x] The unit job is a matrix of shards, and every test runs in exactly one shard (total count matches an unsharded run)
- [x] One aggregate check fails if any shard fails, and is the check branch protection requires
- [x] The unit job's wall time on CI is 2 min or less, or the PR says what stops it getting there
- [x] The shard count is chosen from measured times, which are in the PR

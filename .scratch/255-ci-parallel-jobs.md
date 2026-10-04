# 255: Run CI as parallel jobs

**What to build:** The CI workflow runs typecheck and lint, the unit tests, and the visual check as separate jobs that run at the same time, instead of one job running everything in sequence (about 9.8 min). The pipeline's wall time becomes that of its slowest job.

- The visual job builds the app once, outside the test runner's own startup, and serves that build; later jobs (the shards in 257) reuse it as an uploaded artifact.
- The Playwright browser download is cached between runs.
- The deploy workflow stops running the unit tests again before building: CI already gates main, so the build job only builds.
- A failing visual job still uploads its report and screenshots.
- The required status checks that the repository's branch protection names are updated to the new job names, so a PR can't merge with a job missing. (A human step if the agent can't change repository settings: say so in the PR.)

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Overview / Tour:** not applicable (no user-facing change); recorded per CLAUDE.md.

- [ ] Typecheck+lint, unit and visual run as separate jobs, in parallel
- [ ] The visual job builds once and the build is an artifact other jobs can download
- [ ] Browser install is cached; a warm run skips the download
- [ ] The deploy workflow no longer runs the unit tests
- [ ] A failing visual job uploads its report and test results
- [ ] A PR cannot merge with any of the jobs failing or missing
- [ ] Wall time of a green run on CI is stated in the PR, against the 9.8 min baseline

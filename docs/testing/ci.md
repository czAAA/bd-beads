# CI

Part of the testing docs; the rules every test follows are in [`docs/testing.md`](../testing.md).

CI (`.github/workflows/ci.yml`) is the gate: every pull request to `main` runs the jobs below, all at once but the visual check, which waits for the build. GitHub is the proof a change passed; nothing rests on a habit on one machine.

| Job | What it runs |
| --- | --- |
| Typecheck and lint | `npm run typecheck`, `npm run lint`, `npm run knip` |
| Unit tests | The unit, page and Worker tests, in Vitest shards (`--shard` splits by file) |
| Browser component tests | The `*.browser.test.ts` files in Chromium, in Vitest shards; What's inside's whole tours are among them, played on a faster clock |
| Build | The check that the branch keeps every Release note `main` has (`scripts/notes-guard.ts`), then `vite build` alone, once, for every part of the visual check. It skips the type check, which is "Typecheck and lint"'s; the deploy's build keeps it |
| Visual check | The Playwright specs over that build: the offline shell's checks as a part of their own, every other spec split over the shards (`VISUAL_PART`, `playwright.config.ts`). A new spec lands in a shard with no listing |
| Visual report | The parts' reports merged into one HTML report |

- Each suite ends in one job with a stable name, and branch protection requires those three: "Typecheck and lint", "Unit tests passed" (the unit and the browser component shards) and "Visual check passed" (the build and every part of the visual check). The shard counts can change in `ci.yml` without touching branch protection.
- The shard and worker counts are measured, not guessed: each test job prints its runner's cores and memory, the workflow's comments give the counts tried and their times, and Vitest's workers are set there with `BD_TEST_WORKERS`, Playwright's with `VISUAL_WORKERS`.
- A pull request that changes only Markdown is skipped by `paths-ignore`, so its required checks never start and it waits forever: merge it with an admin override.
- The workflow uses `pull_request` (never `pull_request_target`), a read-only token and no secrets, and pins every action to a commit SHA.
- The browser component and visual jobs run in the `mcr.microsoft.com/playwright` image (Chromium and its system libraries built in, so no apt install on the runner). Its tag must equal the `@playwright/test` version in `package-lock.json`; bump both together.
- A failed part of the visual check uploads its `test-results`, and the parts' reports are merged into one HTML report artifact. `bash scripts/ci-failures.sh <pr>` lists a pull request's failed jobs and tests.
- The UX audit's screenshot walk (`npm run ux:walk -- <area>`, ticket 0815, plan in `docs/research/ux-audit/00-plan.md`) is a by-hand tool too, never in CI: it asserts nothing and leaves screenshots and reports in `ux-audit-output/` for an audit session to judge.
- The performance check (`npm run perf`, [`performance-check.md`](performance-check.md)) is run by hand, never in CI: its timings depend on an idle machine. What can be counted rather than timed is a unit test instead: how many times a stroke draws and which rows (`ProjectSurface.test.ts`, ticket 0616).

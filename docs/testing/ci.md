# CI

Part of the testing docs; the rules every test follows are in [`docs/testing.md`](../testing.md).

CI (`.github/workflows/ci.yml`) is the gate: every pull request to `main` runs typecheck, lint and knip, the unit tests (Vitest shards), the browser component tests (Vitest shards too; `--shard` splits by file) and the visual check (Playwright shards over one shared build). GitHub is the proof a change passed; nothing rests on a habit on one machine.

- Each suite ends in one job with a stable name, and branch protection requires those three: "Typecheck and lint", "Unit tests passed", "Visual check passed". The shard counts can change in `ci.yml` without touching branch protection.
- A pull request that changes only Markdown is skipped by `paths-ignore`, so its required checks never start and it waits forever: merge it with an admin override.
- The workflow uses `pull_request` (never `pull_request_target`), a read-only token and no secrets, and pins every action to a commit SHA.
- The browser component and visual jobs run in the `mcr.microsoft.com/playwright` image (Chromium and its system libraries built in, so no apt install on the runner). Its tag must equal the `@playwright/test` version in `package-lock.json`; bump both together.
- A failed visual shard uploads its `test-results`, and the shards' reports are merged into one HTML report artifact.
- The UX audit's screenshot walk (`npm run ux:walk -- <area>`, ticket 0815, plan in `docs/research/ux-audit/00-plan.md`) is a by-hand tool too, never in CI: it asserts nothing and leaves screenshots and reports in `ux-audit-output/` for an audit session to judge.
- The performance check (`npm run perf`, README) is run by hand, never in CI: its timings depend on an idle machine. What can be counted rather than timed is a unit test instead: how many times a stroke draws and which rows (`ProjectSurface.test.ts`, ticket 0616).

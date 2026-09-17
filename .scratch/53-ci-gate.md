# 53: Run tests, types and lint in CI

**What to build:** A red test suite or a type error can no longer reach main, or GitHub Pages, unnoticed.

Today the only automation is the Pages deploy workflow, which runs `npm ci && npm run build` on every push to main. The build's `vue-tsc -b` does catch type errors, so those can't deploy — but 663 tests run nowhere automated, and nothing at all runs on a pull request, which is where all work actually lands.

- **A CI workflow** on `push` and `pull_request`: install, typecheck, test, lint.
- **The deploy workflow gains a test step** before the build, so a failing suite blocks deployment even if something reaches main by another route.
- **ESLint is introduced**, configured with `eslint-plugin-vue`'s essential rules and `@typescript-eslint`'s recommended set, and nothing stylistic. It runs as part of CI and fails the build on any warning.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- Both a pull-request workflow and a deploy gate, not one or the other. Work merges through PRs, so PR feedback is where the value is; the deploy gate is two extra lines and closes the case of something reaching main another way.
- ESLint without Prettier. The existing code style is already consistent, and adopting Prettier on ~14k lines means one enormous reformat commit that degrades `git blame` for very little gain. If formatting drift ever becomes visible, Prettier can be added later against a much smaller diff.
- Blocking from day one, on a deliberately minimal rule set, rather than advisory on a large one. Advisory linting is linting nobody reads — within two weeks the warning count is noise. A minimal set has little or no existing backlog to clear, so the gate is real from the first commit.
- The stylistic layer is exactly the Prettier churn already declined. Rules get added later, deliberately, when one would have caught a bug that actually happened.
- The tsconfig already sets `noUnusedLocals`, `noUnusedParameters` and `noFallthroughCasesInSwitch`, so the highest-value checks are effectively running already; what ESLint adds here is Vue-specific correctness.

- [ ] A CI workflow runs typecheck, tests and lint on pushes and on pull requests
- [ ] The Pages deploy runs the test suite before building, and a failing suite blocks the deployment
- [ ] ESLint is configured with vue essential rules plus the TypeScript recommended set, and no stylistic rules
- [ ] `npm run lint` exists, exits non-zero on any warning, and passes on a clean checkout
- [ ] No Prettier is added and no mass reformat appears in this ticket's diff

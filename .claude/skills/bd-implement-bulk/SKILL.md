---
name: bd-implement-bulk
description: "Implement several tickets in one run: a comma list or range of ticket numbers (0692-0695, 0693,0696). Plans first to avoid conflicts, runs each ticket through bd-implement in its own worktree and sub-agent, in parallel where tickets are independent and in sequence where one blocks another, then merges the pull requests one by one, resolving conflicts with bd-conflicts. Also reached as `/bd-implement -bulk <tickets>`."
disable-model-invocation: true
---

Implement a batch of tickets end to end: plan, run, merge. You are the **orchestrator**: you never implement a ticket yourself. Each ticket is implemented by a sub-agent following `bd-implement`, in its own worktree, and you merge the pull requests in the order the plan fixes. Every rule of `CLAUDE.md` (Implementing tickets) holds for each ticket. Don't ask between steps; the exceptions are named below.

Flags: `-plan` prints the plan (step 2) and stops. `-max N` caps the sub-agents running at once (default 3: each one runs typecheck, lint and vitest, and the full suite peaks near 2 GB). `-budget P` is the share of the plan's 5-hour usage window a run may project up to before it holds new sub-agents back (default 85, step 3.1); `-cost P` sets the points of that window one ticket is assumed to take until the run has measured its own (default 10); `-no-budget` turns the usage gate off, leaving only `-max`.

## 1. Read the batch

0. `git fetch origin main && git pull --ff-only origin main` in the main checkout, once; the sub-agents won't touch it.
1. Parse the argument into ticket numbers: comma-separated items, each a number or a range `A-B` (inclusive). Pad every number to four digits. `0692-0695,0698` is four plus one.
2. `git -C ../bd-beads-docs pull` first, then find each ticket: `.scratch/NNNN-*.md`. A number with no file there is looked up in `.scratch/.archive/` (by `ls`) and `docs/specs/`: an archived ticket or a spec is dropped from the batch and named in the plan. A number nobody holds is dropped the same way.
3. Read each ticket in full. Record its `**Blocked by:**` numbers and its `**Status:**`.
   - `ready-for-agent` runs.
   - `done`, `wontfix` are dropped.
   - Anything else (`needs-triage`, `needs-info`, `ready-for-human`): ask once, for all of them together, whether to run them anyway, before the plan. This is one of the two questions the skill asks.
4. A ticket that already has a worktree (`git worktree list | grep bd-beads-NNNN`) or an open PR (`gh pr list --json number,title,headRefName --jq '.[] | select(.title | test("\\[NNNN\\]"))'`) is **not re-implemented**: an open PR goes straight into the merge queue (step 4); a worktree with unpushed work gets a sub-agent that resumes there (brief it with what `git status` and `git log origin/main..HEAD` show) instead of a fresh one.

## 2. Plan the run, before starting anything

The point of the plan is to avoid merge conflicts between tickets that are open at the same time, and to find the dependencies the tickets don't declare.

1. **Declared edges.** `Blocked by` inside the batch is an edge: the blocked ticket starts only after the blocker's PR is merged. A blocker outside the batch that is open in `.scratch/` (not archived) means the ticket can't start: drop it and say which blocker holds it. An archived blocker is satisfied.
2. **Footprints.** For each ticket, predict the files it will touch: grep the codebase for the names in the ticket (components, modules, catalogs, glossary terms, test files, `src/styles/`, `docs/glossary/`, `CONTEXT.md`, design-system cards). Note the files it will create, and the shared registries it must register in (an index, a catalog list, a translations file, a glossary README). Keep each footprint to the files you are fairly sure of; a guess is marked as one.
3. **Overlap matrix.** For each pair of tickets without a declared edge, compare footprints; an open PR outside the batch (`gh pr list --json files`) counts as a ticket already running:
   - **Disjoint**: run in parallel.
   - **Shared registry only** (both append to the same list, index or strings file, nothing else in common): run in parallel, and tell both sub-agents the exact file and the rule "append your entry at the end of the existing list, keep its order, don't reformat or reorder anything else in that file". Conflicts there are small and `bd-conflicts` handles them.
   - **Same module or same functions**: run in sequence, as if the second were blocked by the first. Order: the one with the wider footprint first (its merge is the one others must absorb), then by ticket number.
   - **Wide refactor** (a rename or move whose footprint spans the codebase): it runs alone, before everything that overlaps it, and nothing starts while it is open except tickets disjoint from it.
4. **Waves and merge order.** From the edges, build waves: wave 1 is every ticket with no unmet edge, wave 2 those released by wave 1's merges, and so on. Inside a wave, up to `-max` tickets run at once; the rest start as slots free up. The **merge order** is the planned order inside a wave (wide first, then by number), but a PR that is ready earlier merges earlier if it is in the same wave and has no edge to a later one: readiness wins, the plan only breaks ties.
5. **Per-ticket conflict notes.** For every pair that will be open at the same time and shares a file, write one line each sub-agent gets: which file, what the other ticket adds there, and how to keep the diff narrow (new file instead of editing a shared one where the standards allow, append rather than insert, no drive-by refactors or renames in shared files, no reformatting).

Print the plan as a table: ticket, title, wave, runs after (edges and sequencing decisions, with the reason), predicted shared files, merge order. Then the dropped tickets with reasons. With `-plan`, stop here. Otherwise go on without asking.

## 3. Run the tickets

Launch each runnable ticket as a **sub-agent** (`general-purpose`, run in the background), one per ticket, at most `-max` at a time, and only when the usage gate (3.1) says `start`. The sub-agent cannot invoke `bd-implement` itself (it is user-only), so the brief points it at the skill's file to read; don't copy the skill's text into the brief, where it could be shortened or reworded. The brief holds, in this order:

1. The ticket path, its full text, and the batch context: "Ticket NNNN of a bulk run; tickets X, Y are being implemented at the same time in other worktrees. Don't touch their areas."
2. The standing orders of `CLAUDE.md` (Implementing tickets), spelled out, with one change for a shared repo: don't touch the main checkout (the orchestrator keeps local `main` current; several sub-agents pulling it at once would collide on its index). Instead `git fetch origin main`, then the worktree at `../bd-beads-worktrees/bd-beads-NNNN/` from `origin/main` (`git worktree add -b type/NNNN-slug ../bd-beads-worktrees/bd-beads-NNNN origin/main`), `bash scripts/link-docs.sh` there, work only there. Then as usual: `/bd-review` when done; `npm run check`, `npm run test:related`, `npm run test:full`; commit, push, open the PR titled `type:[NNNN] Description` (`docs/agents/pull-requests.md`); then, unlike a single `bd-implement` run, watch CI with `gh pr checks <n> --watch --fail-fast`, fix failures (`bash scripts/ci-failures.sh <n>`) and push again until it is green, because the orchestrator merges only green PRs, in order; don't serve on the tailnet. All worktrees share one `.git`: a git command that fails on a `.lock` file is another sub-agent's fetch or push, so wait a few seconds and retry it.
3. The instruction "Read `.claude/skills/bd-implement/SKILL.md` and follow it as your own instructions", with the overrides of a bulk run: the points of 2 win where they differ, such as its "don't watch CI": in a bulk run the sub-agent watches its PR's CI as point 2 says (the orchestrator then watches it again after each merge of main, step 4).
4. The ticket's conflict notes from step 2.5, verbatim.
5. The docs-repo rule for a shared clone: every worktree's `.scratch/` is the **same** docs repo, and other sub-agents edit their tickets in it at the same time. When archiving, `git -C ../bd-beads-docs pull --rebase` first, stage only your own ticket file(s) by path (never `git add -A`), commit, push; if the push is rejected, pull with rebase and push again. Never stash or reset the docs repo.
6. What to report back, as the last message: PR number and URL, CI result (green, or the failing check and why it couldn't be fixed), the files changed, what was left for a human, whether the ticket is archived, and the `Skills used:` line. Nothing else: the report is read by the orchestrator, not the user.

Launch the first wave in one turn, as far as `-max` and the gate allow: ask the gate once per launch, counting the ones already launched in that turn as running. Then wait: a finished sub-agent wakes you; don't poll. On each completion, record its report, then run step 4 for its PR, then start the next runnable ticket (a slot freed, or a ticket whose edges are all merged) if the gate allows. A sub-agent that reports a failure it could not fix (CI red, tests it couldn't make pass, a ticket that turned out to need a human decision) is listed under the final report's "needs a human"; its PR stays open, is not merged, and the tickets it blocks don't start.

### 3.1 The usage gate

Every sub-agent this run starts, and the orchestrator itself, draws on the same 5-hour usage window of the plan, and a sub-agent cut off by the limit loses everything it hadn't pushed. So before each launch, ask `scripts/usage-budget.sh` whether one more fits (skip this with `-no-budget`):

1. At the start of the run, make a ledger file once (`mktemp`) and keep its path; it adds up what the run has used across resets.
2. Before each launch: `bash scripts/usage-budget.sh --running <sub-agents running now> --budget <-budget> --ledger <file> --finished <tickets whose sub-agent has reported>`, plus `--cost <-cost>` only when the user gave `-cost`. Until a ticket has finished it assumes 10 points a ticket; after that it divides what the run has used by the tickets finished. It prints one line:
   - `start ...`: launch.
   - `wait ... resets=HH:MM resets_at=<epoch>`: don't launch. Running sub-agents carry on, and merging (step 4) carries on. Add `paused: 5h usage at N%, next start after HH:MM` to Progress. When the next sub-agent finishes, ask again. If none is running, wait for the reset with a background command (`run_in_background`) that sleeps until `resets_at` plus two minutes; it wakes you when it exits. Then ask again.
   - `wait ... window=seven_day`: the weekly limit is nearly used up and its reset is days away. Don't wait for it: start nothing more, let the running sub-agents and the merges finish, then end the run (step 5) with the tickets not started listed as "not started: weekly usage limit". A later run picks them up again.
   - `unknown reason=...`: there is no usable snapshot (the status line doesn't write it, it is older than 15 minutes, or the account has no plan limits). Launch on `-max` alone and say once in Progress that the gate is off and why.
3. The snapshot comes from the status line: it writes `rate_limits` from its stdin JSON to `~/.claude/usage-snapshot.json` (the script's header has the line), and `statusLine.refreshInterval` (60 seconds) keeps it fresh while you wait.
4. Never stop a running sub-agent to save usage: one stopped halfway wastes what it has already spent. A conflict sub-agent (step 4.3) asks the gate the same way and goes before any ticket waiting to start, because it is what lets finished work land.

## 4. Merge one by one

Merge each PR as it becomes ready, never two at once, in the merge order of step 2.4. For a PR:

1. **Check it.** `gh pr view <n> --json state,isDraft,mergeable,mergeStateStatus,title,files` and `gh pr checks <n>`. The title must be `type:[NNNN] Description`; a draft or a failing check is not ready.
2. **Bring main in, if main moved.** If any merge happened in this run since the branch last synced with `origin/main` (or `mergeStateStatus` is `BEHIND` or `DIRTY`), merge `origin/main` into the branch in its worktree (`git -C ../bd-beads-worktrees/bd-beads-NNNN fetch origin main && git -C ... merge origin/main`), push, and watch CI again (`gh pr checks <n> --watch --fail-fast`). Merge, never rebase: no force-push. This is what keeps "one by one" safe: the PR's CI runs on the main it will land on.
3. **Conflicts.** If the merge in 4.2 conflicts, or `mergeable` is `CONFLICTING`: run `bd-conflicts` for that worktree: yourself if only `.md` files conflict (its fast path), otherwise in a sub-agent (`general-purpose`, started when the usage gate of 3.1 says `start`) briefed with the worktree path, the ticket, the PR number, the merged ticket(s) that caused the conflict with their PR numbers, and the instruction to invoke the `bd-conflicts` skill from inside that worktree and report the dropped-or-reshaped hunk list. Wait for it, then watch CI, then go on. If it reports it could not resolve without losing functionality: leave the PR open, list it under "needs a human", and go on to the next PR.
4. **Merge.** `gh pr merge <n> --squash` (the repo's method; it keeps the title as the commit subject). Branches are not deleted on merge and worktrees stay in place: that is for the user to prune, not this skill. Then `git -C <main checkout> pull --ff-only origin main` so local `main` is current for the next worktree.
5. A PR whose required checks never start (it changes only `.md` files, so CI skips it) needs `--admin`: this is the second question the skill asks. Ask, once per such PR; while waiting, keep running and merging the others.
6. After the merge, release the tickets it blocked (step 3).

Keep a running `## Progress` note in your own messages whenever something lands (wave started, PR merged, conflict resolved, paused for usage and resumed), one line each, so the user can follow from another device.

## 5. Finish

The run is over when every ticket in the batch is merged, dropped, waiting on a human, or not started because the weekly usage limit is nearly reached (3.1). Final message:

- A table: ticket, PR, result (merged / open, needs a human / dropped / not started: weekly usage limit), one line of why for anything not merged.
- Usage: the 5-hour percentage at the start and at the end, the measured points per ticket, and every pause with its length.
- Conflicts met and how each was resolved (the dropped-or-reshaped lists from `bd-conflicts`).
- What is left for a human, per ticket, collected from the sub-agents' reports (plus the open PRs and the worktrees left behind).
- `Skills used:` listing every skill you and the sub-agents invoked.

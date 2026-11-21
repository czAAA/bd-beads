---
name: bd-review
description: "Review and fix the current work (uncommitted changes plus commits, or the open PR) against origin/main, with no arguments needed. Two axes in parallel sub-agents: Standards (documented coding standards, smells, tests) and Spec (the originating ticket or session goal). Then fixes every clear finding and leaves the judgement calls to the user. Use when the user wants to review a branch, a PR or work in progress."
---

Two-axis review of the current work against `origin/main`, then fix what is clearly wrong. The user supplies nothing.

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating ticket / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context. Keep them two: one reviewer doing both axes cost a third to two thirds less on three recorded reviews but missed real findings on each, the smallest diff worst (ticket 1178). A diff that touches only docs or config is reviewed inline, without sub-agents.

## Process

### 1. Prepare, in one command

From the work's worktree run `bash <this skill's folder>/prep.sh`. The fixed point is always `origin/main`, never local `main`, and the work is everything since the merge-base, committed or not, untracked files included, so the one command covers a branch, a PR and work in progress. It fetches `origin/main`, writes the diff as files into `.review/` (ignored by git; the index is not touched) and prints a summary. Don't capture the diff, the commits, the PR or the ticket by hand, and don't read the diff into this session: the reviewers read it from the files.

Act on the summary:

- **It exits 1** (no merge-base, or nothing to review): stop and say so. Fail here, not inside the sub-agents.
- **`left out`**: files kept out of the diff (the lock file, an untracked file that looks accidental or holds secrets). Say so in the report.
- **`code files 0`**: the diff touches only docs or config. Review it inline, without sub-agents: read the diff parts, the two briefs and `.claude/agents/bd-reviewer.md` (how to read and what a finding holds) yourself.
- **`pr title BAD`**: an open PR's title must match `type:[NNNN] Description` (`docs/agents/pull-requests.md`); a mismatch is a hard finding.
- **`release pr yes`**: a release PR (`release: X.Y.Z`, no ticket; `docs/agents/pull-requests.md`, The release PR) holds only what `npm run release` wrote, so check that and skip the Spec sub-agent.
- **`release notes`**: if the diff adds or touches a Release note (`src/data/releaseNotes/*.json`), check its kind against the rules in `docs/agents/pull-requests.md` (Release notes) yourself, as a Spec finding: a `fix` PR's note that isn't Fixed, a kind smaller than the change (the bigger kind wins), or a New note with no sign the owner said yes is a hard finding; so is a title or ticket that names a Version, and a note that is deleted or renamed. A user-facing change with no note is a judgement finding.

### 2. Find the spec

The script looks for the ticket number in the PR title `[NNNN]`, the worktree name `bd-beads-<ticket>`, the branch name and the commit messages, and for its file in `.scratch/`, `.scratch/.archive/` and `docs/specs/`. It puts the ticket, the spec the ticket names and an open PR's description into `.review/context.md` for the Spec reviewer.

Only when it prints `spec not found`, first hit wins:

1. A ticket or spec under `.scratch/` or `docs/specs/` matching the branch name or feature.
2. This session's goal or `bd-implement` prompt.
3. Nothing found: ask once. If there is none, skip the Spec sub-agent and say "no spec available".

### 3. Spawn both sub-agents in parallel

Start them in one message, as `subagent_type: bd-reviewer` (`.claude/agents/bd-reviewer.md`: only Read and Bash, so it starts at about half a general-purpose agent's context) on `model: sonnet`, each with the prompt the script printed for it, unchanged: it names the reviewer's brief (`standards-brief.md` or `spec-brief.md`, next to this file) and `.review/context.md`. If `bd-reviewer` isn't an available type (a session started before it existed), use `general-purpose` and put `Read .claude/agents/bd-reviewer.md and follow it.` before the printed prompt. Add nothing the files already hold. Don't paste the diff, the standards or `smells.md`, and when sub-agents review don't read them yourself: the reviewers read `CODING_STANDARDS.md`, `docs/testing.md`, the smell baseline and the diff parts on their own.

Add to the Spec prompt only a spec the script didn't find: its path, or the session's goal in a few lines.

While they run, do the checks the summary left to you (`release notes`, `pr title`, `release pr`) and write nothing else. Each reviewer wakes the session when it is back: when one is in and the other isn't, end the turn with no message. Say nothing until both are in.

### 4. Fix, then report

Don't reprint the reports: they hold findings only, each with `path:line` and the quoted line, so check them against the code straight away. Keep the axes apart (a change can pass one and fail the other); a finding both reviewers made is one finding.

- **Check each finding against the code first**; drop the false ones and say which.
- **Fix every `hard` finding**, then every `judgement` finding that is plainly right on reading the code (an obvious magic literal, a duplicate of an existing helper, a test that asserts nothing).
- **Never delete behaviour or build a missing feature as a fix**, whatever its label: scope creep and missing requirements go to the user.
- **Leave alone** anything where it is hard to say whether it is an issue: most smells, design trade-offs, scope creep that might be wanted, a missing test of doubtful value. These go under `## Needs your call`.
- Run the check and the related tests (`CLAUDE.md`, Context hygiene) after the fixes. If a fix breaks them and the cause isn't obvious, revert that fix and list it under `## Needs your call`.
- Don't commit or push; the caller does.

Then report, in this shape and no other (a caller such as `bd-implement` carries `## Needs your call` into what it leaves for a human):

- `Fixed:` one line per fix, `path` and what changed.
- `Dropped:` one line per false finding, with why it's false. Leave out if none.
- `## Needs your call`: always, even when empty (`None.`). One line per item: the axis, `path:line`, and why it's unclear.
- A last line: findings per axis, how many fixed, dropped and left for the user.

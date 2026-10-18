---
name: bd-triage
description: Move tickets through the triage state machine: verify, grill if needed, and turn them into agent-ready tickets.
disable-model-invocation: true
---

Move tickets through triage states. Tickets are local files: ticket format, the `**Status:**` line and how they're committed are in `docs/agents/issue-tracker.md`; the labels in `docs/agents/triage-labels.md`. Pull the docs repo first; commit and push every change to it at once.

## States

Each ticket's `**Status:**` holds exactly one state; if it's missing or holds two, flag it and ask before anything else.

- `needs-triage`: maintainer must evaluate. A ticket with no status goes here first.
- `needs-info`: waiting on an answer; returns to `needs-triage` once it comes.
- `ready-for-agent`: fully specified for an AFK agent.
- `ready-for-human`: needs a human (judgement calls, external access, design decisions, manual testing).
- `wontfix`: will not be actioned.

The maintainer can override any transition; flag unusual ones and ask first.

## Invocation

The maintainer describes what they want ("what needs my attention", "look at 42", "move 42 to ready-for-agent", "what's ready for agents?"). Act on it.

**Needs attention:** list, oldest first, with counts and one line each: (1) no status, (2) `needs-triage`, (3) `needs-info` whose ticket changed since its triage notes (`git -C ../bd-beads-docs log`). Let the maintainer pick.

**Quick override:** "move 42 to X": trust them, confirm what you'll change, act, skip grilling. For `ready-for-agent`, ask whether to rewrite the ticket as a brief.

## Triaging one ticket

If the ticket has triage notes, read them, check what's been answered since, and show the updated picture before continuing; don't re-ask resolved questions.

1. **Gather context.** Read the whole ticket. Explore the codebase with the glossary, respecting ADRs. Check (a) **redundancy**: is the behaviour already implemented (search by domain concept, report where you looked)? then it's an already-implemented `wontfix`; (b) **prior rejection**: `grep -l 'Status:\*\* wontfix' .scratch/.archive/*.md` and surface any that resembles it.
2. **Recommend** a state with reasoning and a short codebase summary. Wait for direction.
3. **Verify the claim** before grilling. Bug: reproduce it from the ticket's steps. Report confirmed (with code path), failed, or insufficient detail (a strong `needs-info` signal).
4. **Grill if it needs fleshing out**: invoke `bd-grill-docs` and work it into shape.
5. **Apply the outcome** in the ticket file:
   - `ready-for-agent`: rewrite the ticket as a brief in the tracker format: what the system should do, not how; no file paths or line numbers; each checkbox a testable outcome; what's out of scope. `ready-for-human`: same, plus a line on why it can't be delegated.
   - `needs-info`: add the notes below under the checklist.
   - `wontfix`: say why in the ticket (already implemented: where it lives; rejected: the reason, so the prior-rejection check finds it), then move it to `.scratch/.archive/`.

```markdown
### Triage notes

**Established so far:**
- ... (everything settled while grilling)

**Still needed:**
- ... (specific and actionable, never "please provide more info")
```

---
name: bd-tickets
description: Break a plan, spec, or the current conversation into tracer-bullet tickets, each declaring its blocking edges, written as ticket files per docs/agents/issue-tracker.md.
disable-model-invocation: true
---

Break a plan, spec or conversation into **tickets**: tracer-bullet vertical slices, each naming the tickets that **block** it. Ticket format, numbering and where files go: `docs/agents/issue-tracker.md` (read it first; it wins over anything here).

## Process

1. **Gather context.** Use the conversation; if the user passes a spec path or ticket, read it in full. Explore the codebase if you haven't, use the glossary's words, respect the ADRs, and look for prefactoring that makes the change easy ("make the change easy, then make the easy change").

2. **Draft vertical slices.**
   - Each slice cuts a narrow but COMPLETE path through every layer (not one horizontal layer), is demoable or verifiable alone, and fits one fresh context window.
   - Prefactoring goes first. List each ticket's blockers; no blockers means it can start now.
   - **Wide refactors are the exception** (one mechanical change whose blast radius spans the codebase, so no slice lands green): sequence as expand–contract. Expand (new form beside the old), then migrate call sites in batches by blast radius (each its own ticket, blocked by the expand), then contract (delete the old form, blocked by every batch). If batches can't stay green alone, let them share an integration branch that blocks a final integrate-and-verify ticket; only that one must be green.

3. **Quiz the user.** Show a numbered list: title, blocked by, what it delivers. Ask whether granularity is right, whether each blocker really gates its ticket, and whether any should merge or split. Iterate until approved.

4. **Write the tickets**, blockers first, as the tracker doc says, and commit and push them to the docs repo as it describes. Status `ready-for-agent` unless told otherwise. Don't close or modify any parent ticket.

Each ticket's "What to build" is the end-to-end behaviour from the user's view, not a layer list. Avoid file paths and code snippets (they go stale); the one exception is a snippet from a prototype that encodes a decision more precisely than prose (state machine, schema, type shape): inline just the decision-rich part and say it came from a prototype.

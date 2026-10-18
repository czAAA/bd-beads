---
name: bd-spec
description: "Turn the current conversation into a spec in docs/specs/: no interview, just synthesis of what you've already discussed."
disable-model-invocation: true
---

Synthesize a spec from the conversation and codebase understanding. Do NOT interview the user. Where specs live, how they're numbered and committed: `docs/agents/issue-tracker.md`.

1. Explore the repo if you haven't. Use the glossary's words and respect the ADRs.

2. Sketch the seams you'll test at: prefer existing seams, the highest possible, ideally one. Check them with the user.

3. Write the spec with the template below and save it as the tracker doc says (`docs/specs/NNNN-slug.md`, the next number in the shared ticket/spec space, committed and pushed to the docs repo). Specs aren't tickets, so no triage label. Next step: `/bd-tickets`.

```
# NNNN: Title

Implements ADR NNNN. Ticket NNNN. (the ADRs and tickets it builds on, if any)

## Problem Statement
The problem, from the user's perspective.

## Solution
The solution, from the user's perspective.

## User Stories
Numbered, "As an <actor>, I want <feature>, so that <benefit>", covering every aspect of the feature.

## Implementation Decisions
Modules built or changed, their interfaces, technical clarifications, architecture, schema changes, API contracts, key interactions.
No file paths or code snippets (they go stale). Exception: a prototype snippet that encodes a decision more precisely than prose (state machine, schema, type shape): inline the decision-rich part and say it came from a prototype.

## Testing Decisions
What makes a good test here (external behaviour, not implementation), which modules are tested, prior art in the codebase.

## Out of Scope

## Further Notes
```

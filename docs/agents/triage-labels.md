# Triage labels

This repo uses six canonical triage labels:

| Label | Meaning |
| --- | --- |
| `needs-triage` | Newly reported; not yet assessed |
| `needs-info` | Waiting on clarification from reporter or stakeholder |
| `ready-for-agent` | Clear, actionable, ready for an agent to solve |
| `ready-for-human` | Needs human judgment or domain expertise |
| `wontfix` | Intentionally not addressed |
| `done` | Implemented and shipped |

These labels are stored in the frontmatter of `.scratch/<issue>/issue.md` and managed by the `triage` skill.

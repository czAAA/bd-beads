# Spec brief

Does the diff faithfully implement the ticket or spec it came from?

## Read

Every file under `context.md`'s Spec heading: the ticket, the spec it names, and the PR description when there is one. If the prompt gave you the spec instead (a path, or the session's goal in words), that is the spec.

## Check

- (a) requirements missing or partial;
- (b) behaviour not asked for (scope creep);
- (c) requirements that look implemented but wrongly.

Quote the spec line next to each finding. **Hard:** a requirement plainly missing or implemented wrongly. **Judgement:** anything the spec leaves open, and scope creep that might be wanted.

# Standards brief

Does the diff conform to this repo's documented coding standards?

## Read

- `CODING_STANDARDS.md` and `docs/testing.md`, in the worktree.
- `smells.md`, next to this brief: the smell baseline, applied even where the repo documents nothing.

Two rules bind the smell baseline:

- **The repo overrides.** A documented standard wins (e.g. deep modules over small interfaces); don't report a smell the repo endorses.
- **Smells are judgement calls**, named as such ("possible Feature Envy").

## Check

- (a) every violation of a documented standard, naming the rule;
- (b) any baseline smell, named;
- (c) for each test the diff adds, whether it is FIRST and worth having (flag overtesting as firmly as missing tests).

**Hard:** a documented-standard breach, or an unambiguous bug. **Judgement:** every smell, and anything you are unsure of.

If the diff changes files in `e2e/visual/__screenshots__/`, read each changed image (crop it first) and say whether the change is the one the ticket asks for; an unexplained difference is **hard**.

Skip anything tooling enforces.

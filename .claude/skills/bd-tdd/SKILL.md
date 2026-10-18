---
name: bd-tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests.
---

TDD is the red → green loop. Consult this before and during every cycle. Read `CONTEXT.md` so test names use the domain's words, and respect the ADRs. Repo test conventions: `docs/testing.md`.

## What a good test is

It verifies behaviour through a public interface, so code can change entirely and the test survives. It reads like a spec ("user can check out with a valid cart"). Examples: [tests.md](tests.md); mocking: [mocking.md](mocking.md).

## Seams: where tests go

A **seam** is the public boundary you test at. Tests live at seams, never against internals, at the highest seam that already exists (`docs/testing.md`). Before writing any test, state the seams under test and confirm them with the user ("what's the public interface, and which seams should we test?"); no test at an unconfirmed seam. This keeps effort on critical paths and complex logic, not every edge case. If the shape of the interface is itself in question, consult `bd-design` for the vocabulary (reference, not a session).

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or checks via a side channel (querying the DB instead of the interface). Tell: breaks on refactor with no behaviour change.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`), so it can't disagree with the code. Expected values come from an independent source: a literal, a worked example, the spec.
- **Horizontal slicing**: all tests first, then all code. Tests then verify imagined behaviour. Go vertical: one test → one implementation → repeat, each a tracer bullet informed by the last.

## Rules of the loop

- **Red before green.** Failing test first, then only enough code to pass. No speculative features.
- **One slice at a time**: one seam, one test, one minimal implementation.
- **Refactoring isn't in the loop**; it belongs to `bd-review`.

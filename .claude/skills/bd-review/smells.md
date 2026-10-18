Smell baseline: Fowler code smells (_Refactoring_, ch.3) plus a few KISS/SOLID checks. Match each against the diff.

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file.
- **Reinvented Existing**: new code that duplicates a helper, constant, type or enum already in the repo (grep before accepting a new one), or a value defined twice.
- **Magic Literal**: an unexplained number or string (a threshold, size, key, status or mode) inline where a named constant or enum member would say what it means, especially when it repeats.
- **Feature Envy**: a method that reaches into another object's data more than its own.
- **Data Clumps**: the same few fields or params keep travelling together.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type.
- **Repeated Switches** (OCP): the same `switch`/`if`-cascade on the same type recurs across the change.
- **Shotgun Surgery**: one logical change forces scattered edits across many files.
- **Divergent Change** (SRP): one file or module is edited for several unrelated reasons.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on.
- **Middle Man**: a class or function that mostly just delegates onward.
- **Refused Bequest** (LSP): a subclass or implementer that ignores or overrides most of what it inherits.
- **Needless Complexity** (KISS): deep nesting, a long function, or clever code where plain code would do.
- **Fat Interface** (ISP): callers or implementers forced to depend on members they never use.
- **Concrete Dependency** (DIP): logic that constructs or imports a concrete collaborator the code already needs to swap (several real implementations). Not for tests alone: `docs/testing.md` adds no seam only to reach an internal.

Test checks: apply to every test the diff adds or changes. Judgement calls too; `docs/testing.md` overrides.

- **Not FIRST**: the test is slow (real timers, network, disk, browser where a unit would do), depends on another test's order or leftover state, flaky or time/random dependent, or needs a human to read output (no real assertion).
- **Overtesting**: a test that can't fail for a real reason. Flag these:
  - tests of implementation details, private helpers or mock call order rather than behaviour
  - re-testing the framework, types or trivial getters
  - several tests pinning the same behaviour
  - snapshots of incidental output
  - assertions that restate the code
- **Missing test**: new behaviour with real branching, a bug fix without a regression test, or an edge the spec names, left untested.

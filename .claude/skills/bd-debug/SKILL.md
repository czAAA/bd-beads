---
name: bd-debug
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

Discipline for hard bugs. Skip a phase only with a stated reason. Read `CONTEXT.md` and the ADRs for the area first.

**Redact every secret** in commands, output and captured artifacts (`<REDACTED>`). Build loops against env vars; quote only the lines that carry the signal. If redacted output isn't enough, ask the user.

## 1. Build a feedback loop

This is the skill. A tight pass/fail signal for _this_ bug finds the cause; without one, reading code won't. Spend disproportionate effort here.

Ways to build one, roughly in order: failing test at whatever seam reaches the bug; curl/HTTP script; CLI run diffed against a snapshot; headless-browser script (Playwright) asserting on DOM/console/network; replay of a captured trace; throwaway harness around one function; property/fuzz loop; `git bisect run` harness; differential run of old vs new; last resort, a human-in-the-loop script (`scripts/hitl-loop.template.sh`).

Then tighten it: faster (narrow scope, skip init), sharper (assert the exact symptom, not "didn't crash"), more deterministic (pin time, seed RNG, isolate fs/network). For flaky bugs, raise the reproduction rate (loop 100×, add stress, narrow timing) until it's debuggable: 50% is, 1% isn't.

**Done when** one command, already run once (show invocation and redacted output), is: red-capable (asserts the user's exact symptom, so it goes green only when fixed), deterministic, fast (seconds), and runnable unattended. No such command, no phase 2: reading code for a theory first is the failure this skill prevents.

Can't build one? Stop, list what you tried, and ask for access to the environment, a redacted artifact (HAR, log, dump), or permission to add temporary instrumentation. Don't hypothesise without a loop.

## 2. Reproduce and minimise

Run it; confirm it fails the way the **user** described (wrong bug, wrong fix), reproducibly, and note the exact symptom. Then cut inputs, callers, config and steps one at a time, re-running after each, until every remaining element is load-bearing. The minimal repro becomes the regression test.

## 3. Hypothesise

Write 3–5 ranked, falsifiable hypotheses before testing any: "If X is the cause, changing Y makes the bug disappear." No prediction, no hypothesis. Show the list to the user (they may re-rank it) but don't block on it.

## 4. Instrument

One probe per prediction, one variable at a time. Prefer a debugger/REPL, then targeted logs at the boundaries that split the hypotheses; never "log everything and grep". Tag every debug log `[DEBUG-xxxx]` so cleanup is one grep. For performance, measure a baseline (timer, profiler, query plan) and bisect instead of logging.

## 5. Fix and regression test

Write the regression test before the fix, but only at a seam where it exercises the real bug pattern at the call site. A too-shallow seam gives false confidence; if no correct seam exists, that is itself a finding: note it. Otherwise: failing test from the minimal repro → watch it fail → fix → watch it pass → re-run the phase 1 loop on the original scenario.

## 6. Clean up

Before done: original repro passes; regression test passes (or the missing seam is documented); `[DEBUG-` greps empty; throwaway prototypes deleted; the confirmed hypothesis is in the commit/PR message.

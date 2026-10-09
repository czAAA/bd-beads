# A feature that isn't ready is switched off in `src/features.ts`, with its code kept

**Status: accepted.** Tickets 174, 247. Code catches up in ticket 365 (Mirror moves to a flag).

A feature that is built but not ready to be shown is switched off by a constant in `src/features.ts` (`TOUR_ENABLED = false`). Only the way in is hidden; its code and tests stay, and the tests run it with the flag on, so turning it back on is flipping one constant. Every switched-off feature is a flag there: nothing is hidden by hand in a component.

This is not the build flag [ADR 0006](0006-live-mirror-while-drawing.md) retired. That one was a rollback guard for a feature already shipped and trusted, which kept a stale old path alive for no speed over `git revert`. A flag in `features.ts` holds back a finished feature that isn't ready to be shown (for product reasons, or pending a redesign), and goes when the feature ships or is deleted.

**Considered options**: deleting a held-back feature and reverting it later (rejected: a large feature such as the Tour would rot on a branch while the app moves on).

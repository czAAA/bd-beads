# Modal

A centered dialog for confirmations (Delete all?, Replace bead?) and the keyboard shortcuts. (Derived in DESIGN.md.)

- Width 420 (confirm) to 560 (panels), `canvas` fill in light / `panel` in dark (plus a 1px `line-strong` border), radius-lg, `elevation-3`, padding 24.
- **Scrim:** `rgba(0,0,0,.32)` light, `rgba(0,0,0,.6)` dark.
- **Title:** `title` role (16/24 600). **Body:** `body` role.
- **Actions:** right-aligned, 8 apart. Confirm is primary, or danger-filled (`danger`, white text) for destructive actions; cancel is secondary.
- Escape and the scrim cancel. Focus is trapped inside and returns to the opener on close.

**Large (tickets 0646, 0756):** gone. The Convert image wizard was the only large Modal; it is an App page in the canvas box now (ConvertImage card, ADR 0086), so the Modal has three sizes, 420, 560 and the narrow one. A page can open a confirmation over itself, which a popup could not (StackingOrder card).

Hand-written from DESIGN.md §5.13; static rendition. Preview copy is illustrative.

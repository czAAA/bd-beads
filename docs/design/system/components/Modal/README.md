# Modal

A centered dialog for confirmations (Delete all?, Replace bead?) and the keyboard shortcuts. (Derived in DESIGN.md.)

- Width 420 (confirm) to 560 (panels), `canvas` fill in light / `panel` in dark (plus a 1px `line-strong` border), radius-lg, `elevation-3`, padding 24.
- **Scrim:** `rgba(0,0,0,.32)` light, `rgba(0,0,0,.6)` dark.
- **Title:** `title` role (16/24 600). **Body:** `body` role.
- **Actions:** right-aligned, 8 apart. Confirm is primary, or danger-filled (`danger`, white text) for destructive actions; cancel is secondary.
- Escape and the scrim cancel. Focus is trapped inside and returns to the opener on close.

**Large (ticket 0646):** the Convert image wizard's size, from 1024 px wide in landscape. `modal-large-width` × `modal-large-height` (1200 × 820), never more than the viewport less 24 (`space-24`) on each side, centred; padding 0, since a 56 header (title, Close icon button) and a pinned 64 footer, each with a 1px `panel-rule`, hold the edges and the body lays out its own panes (ConvertImage card). Under 1024 px or in portrait the same content is a full-screen sheet (PhoneForms card). Escape and Close close the wizard at once, a picture set or not (ticket 0679). Fill, edge, radius, shadow, scrim and focus as above.

Hand-written from DESIGN.md §5.13; static rendition. Preview copy is illustrative.

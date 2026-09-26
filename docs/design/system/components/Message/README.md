# Message

A notice or toast: "couldn't save", import results and errors, confirmations of an action. (Derived in DESIGN.md.)

- **Shape:** `panel` fill (light) / `elevated` (dark), 1px `panel-line` (light) / `line-strong` (dark), radius-lg, `elevation-3`, padding 12 16, max width 420. A 3px left edge in the tone: `accent` for info and success, `warning`, or `danger`.
- **Content:** a 16px icon in the tone color, the text (`body`), optional text-button actions, and a 28px close ×.
- **Placement:** library-wide notices use the notice row under the header, full width, at elevation 0. Short-lived results show as a toast at the bottom-right of the canvas box, 16px in, above the Progress bar, and go after 5s unless hovered or focused. Errors stay until closed.
- Import results and errors show beside the header button that caused them as a compact one-line message (no shadow, no close).

Hand-written from DESIGN.md §5.12; static rendition. Preview copy is illustrative.

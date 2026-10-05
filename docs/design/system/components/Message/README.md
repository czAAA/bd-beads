# Message

A notice or toast: "couldn't save", import results and errors, confirmations of an action. (Derived in DESIGN.md.)

- **Shape:** `panel` fill (light) / `elevated` (dark), 1px `panel-line` (light) / `line-strong` (dark), radius-lg, `elevation-3`, padding 12 16, max width 420. A 3px left edge in the tone: `accent` for info and success, `warning`, or `danger`.
- **Content:** a 16px icon in the tone color, the text (`body`), optional text-button actions, and a 28px close ×.
- **Placement:** library-wide notices use the notice row under the header, full width, at elevation 0. Short-lived results show as a toast at the bottom-right of the canvas box, 16px in, above the Progress bar, and go after 5s unless hovered or focused. Errors stay until closed.
- Import results and errors show beside the header button that caused them as a compact one-line message (no shadow, no close).
- **Palette is full** (toast, info tone): when 28 colors are already added to the Palette, a new Custom color still paints but is not added. English: "The Palette is full: this color painted, but it wasn't added." Russian: «Палитра заполнена: цвет нарисован, но в палитру не добавлен.»
- **Color removed** (toast, info tone, with Undo): after an added swatch is removed from the Palette. English: "Color removed from the Palette." with the text action "Undo". Russian: «Цвет удалён из палитры.» with «Отменить». The action is a text button (`control`, `ink`, underlined) before the close ×. Like other toasts it goes after 5s unless hovered or focused; Undo puts the swatch back. Russian reviewed in ticket 283 (matches Delete wording).

Hand-written from DESIGN.md §5.12; static rendition. Preview copy is illustrative, except the Palette is full toast, which is the app's string in English and Russian.

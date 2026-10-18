# TopSheet

The shell Menu and Project open in under 1024px: a sheet that slides down from under the Canvas strip, the counterpart of the ToolSheet that rises from the bottom. The content is the MenuPanel or ProjectPanel card, unchanged. (Spec 0440, ticket 0443.)

- **Anchor:** inside the canvas box, its top edge on the strip's bottom edge, the full width of the box. The strip is never covered: Menu and Project stay visible, and the open one stays lit (`ink` fill, `canvas` text).
- **Material:** `overlay-fill`, no top or side edge, a 1px `overlay-line` bottom edge (2px `line-strong` in high contrast), bottom corners `top-sheet-radius` (18px), `elevation-3`, padding 8 10 0.
- **Sub-view:** a panel's sub-view (New Project, MenuPanel card) takes the sheet's body under a Back header, with its footer button pinned above the handle; only the body scrolls.
- **Height:** as tall as its content, at most the canvas box's height minus the strip and 40px. Longer content scrolls inside, with no visible scrollbar. The handle never scrolls.
- **Handle:** at the bottom edge, a 36 × 4px `line-strong` bar, `radius-full`, 10px above and below. Dragging or tapping it up closes the sheet, as the ToolSheet's handle does downward.
- **Scrim:** `scrim`, from under the strip to the bottom of the canvas box. It dims the drawing area, the tool pill and the Progress bar, not the strip. A tap on the scrim closes the sheet and reaches nothing under it (no stroke, fill or Frame starts).
- **Layers:** the sheet and its scrim sit at `z-sheet`, below toasts and dialogs; the Duplicate and Delete dialogs open over it at `z-modal` after it has closed.
- **Closing:** the scrim, the handle, Escape, or the lit button. Focus returns to the button that opened it. Opening Menu while Project is open swaps the sheets with no scrim flash.
- **Motion:** the sheet slides on `transform` over `duration-slow` with `ease-out` and the scrim fades over `duration-base`; closing is `duration-base`. Under reduced motion both only fade. The drawing surface never resizes.
- **Rows** use the sheet sizes: items 48px with a 12px section gap; setting rows grow with their content and never have a fixed height; a stacked row has 12px between its label and its control and 16px under it; consecutive rows are 10px apart. Targets stay at least `touch-target` (44px).
- **Screen readers:** `role="dialog"`, `aria-modal="true"`, named "Menu" or "Project"; focus is trapped in the sheet and the content behind is inert.
- **Dropdown from 1024px:** the same panels open as a dropdown with no scrim (MenuPanel card).

Hand-written from spec 0440 and the Menu and Project mockups; static rendition.

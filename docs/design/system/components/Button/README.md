# Button

Every clickable action in bd-beads: primary, primary select, secondary, secondary in a box, text, link, icon, round icon and expand variants.

## When to use
- **Primary** (`bb-btn bb-btn--primary`): the single most likely next action in a region: New Pattern, Replace bead (as a select), Save Pattern, Row done. `accent` fill and border, `on-accent` text; hover and pressed use `accent-hover`; disabled uses `accent-disabled-bg` / `accent-disabled-fg`. **Two primary buttons never sit next to each other.**
- **Secondary** (`bb-btn`): on the page (header). `button` fill, `button-line` border, `ink` text; hover `surface` in light, `elevated` in dark.
- **Secondary in a box** (`bb-btn--in-box`): inside the save box and Saved Patterns: `elevated` fill, `line-strong` border (light) / `elevated` (dark). The Toolbox's own buttons (`bb-btn--toolbox`) use `panel-line` as border.
- **Text** (`bb-btn--text`): Import a file. No fill or border, padding 0 6, hover `surface`.
- **Link** (`bb-link`, `bb-link--danger`; `AppButton variant="link"`, ticket 331, which replaces `AppLink`): Remove line (`ink`), Delete all (`danger`). 14/20 500, 16px icon, gap 6.
- **Icon** (`bb-btn--icon`, 34 × 34, radius-md) and **round icon** (`bb-btn--round`, radius-full): Turn row direction; Keyboard shortcuts.
- **Tool tab** (`IconButton` `variant="tool"`, ticket 330): a 34px icon in a 56 × 72 cell, no fill or border, `muted`; selected is `accent-strong` with a 2px `accent-strong` underline (3px in High contrast), and an optional key badge (DM Mono 11px, `muted`, accent when selected) against the icon's top-right corner. It is a tab of the Tools group (ToolTabs card).
- **Expand** (`bb-expand`): 28 × 28, 1px `line-strong`, radius-full, 14px arrow. Opens an expandable panel (`IconButton`, round, with a Tooltip).
- **Danger fill** (`bb-btn--danger`): the confirm button of a destructive modal only.

## Anatomy
Height 34 (38 in the save box and Edit row, 32 in the Saved Patterns footer). Icon 15px, stroke 1.75, then the label (`control` role), 8px apart, padding 0 12, radius-md. Focus: 2px `accent` outline, 2px offset.

## Labelled button
One component covers every labelled button (ticket 331, ADR 0035), the Link included: an optional leading icon, the label, an optional trailing icon. It shows a Tooltip only when given one, and then only a sentence the label doesn't already say ("Start an empty canvas."), or from a control-registry action, which supplies its label, key chip, enabled state and, when disabled, the reason. A disabled button is `aria-disabled`, still hoverable and focusable, a click does nothing, and its Tooltip says why.

## Icon button
One component covers every icon-only control (ticket 330, ADR 0035): the Tool tab, plain (the canvas strip and ZoomPill), in-box, toolbox, box, round and the sheet close. It shows a Tooltip only when given one (a name, an optional body, the key chip), either explicitly or from a control-registry action, which also supplies its enabled state and, when disabled, the reason (`aria-disabled`, still hoverable, the reason in the Tooltip in place of the key chip).

## What the consumer provides
The label (sentence case), an optional leading icon from the Icons group, and an accessible name for icon-only buttons.

Hand-written from DESIGN.md §5.1; static rendition.

# ToolTabs

The Tools group: five equal tabs (Paint, Fill, Select, Erase, Hand) over a 1px `line-strong` rule, with Remove line and Delete all underneath.

- Each tab: 18px icon above a `tab`-role label, padding 8 0 10, `muted`.
- **Active:** `accent` text and icon plus a 2px `accent` underline overlapping the rule.
- 10px below: **Remove line** (link, left) and **Delete all** (danger link, right).
- **Hand (v16)** moves the open canvas by dragging; shortcut `H`. Holding Space with any tool does the same for as long as it is held.
- There is no Frame tab: the Frame is set from the Frame row below (Frame card).
- The consumer provides the active tool and handlers; the five tools are fixed. Use `bb-tabs--5` for the five-column grid.

Hand-written from DESIGN.md §5.4 and the v16 sign-off; static rendition.

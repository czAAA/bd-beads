# Feature subfolders inside `components/` and `composables/`

**Status: accepted (ticket 225).** Amends ADR 0020: the role-based layers stay; this adds a second level of folders inside two of them.

## Context

`components/` (68 files) and `composables/` (42 files) were flat. An import graph of `src/` showed that features such as tools, export and zoom don't import each other; they meet only in the composition roots (`useAppShell`, `AppShell`, `PhoneSheets`, `AppHeader`). Every feature also imports the shared domain core (Pattern, grid, beads) and the UI primitives.

## Decision

Group the files into feature subfolders, mirrored in both layers: each feature gets `components/<feature>/` and `composables/<feature>/` (a feature may have files on only one side). The folders:

| Folder | What lives there |
|---|---|
| `ui/` | Primitives every feature builds on: buttons, icons, modals, selects, switches, menus, toasts, `form/*`, plus the generic composables (`useEscapeLayer`, `useMediaQuery`, `useElementSize`, `useRovingFocus`, `useToasts`, `tourDom`, …) |
| `canvas/` | The pattern canvas, rulers, zoom controls, framing, pointer, pan and zoom |
| `tools/` | Toolbox, Dock, Mirror controls, Context bar; tool, mirror, paint and selection state |
| `palette/` | Palette and colour pickers, bead quantities, replace-bead flow |
| `export/` | QR, save, export panels and flows |
| `import/` | Pattern import, convert-image, shrink/crop |
| `pattern/` | The pattern library, new pattern, size changes, row operations, undo history, shared links |
| `shell/` | The composition roots and chrome: `AppShell`, header, sidebar, bottom bar, sheets, drawers, theme and language switches, shortcuts |
| `tour/` | The Tour layer, `useTour`, `tourGeometry` |

Rules:

1. **`components/ui/` imports from no feature folder**, in `components/` or `composables/` (`composables/ui/` is not a feature folder). ESLint enforces it.
2. **`domain/` imports nothing from `i18n/`.** The `Locale` type (`domain/locale.ts`) and number formatting (`domain/formatNumber.ts`) live in `domain/`; `i18n/` uses them from there.
3. **No composable imports from a component, types included.** `PhoneSheet` lives in `composables/shell/phoneSheet.ts`.
4. The ADR 0020 rules (domain pure, components never import services, rendering free of Vue) apply to the subfolders unchanged.

## Considered options

- **Colocated feature modules** (`features/export/` holding components, composables and domain together) — rejected: features share the domain core and the UI primitives and meet only in the composition roots, so full modules would add folders without adding real boundaries. Subfolders inside the layers group the files that belong together and keep ADR 0020's role rules readable.
- **Leave the layers flat** — rejected: 110 files in two folders is hard to navigate.

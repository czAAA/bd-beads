# 225: Feature subfolders inside components/ and composables/

**What to build:** A pure refactor that makes the code easier to navigate; users see no change. `src/components/` (68 files) and `src/composables/` (42 files) are flat today. Group them into feature subfolders while keeping the role-based layers from ADR 0020. The layout is mirrored: each feature gets `components/<feature>/` and `composables/<feature>/`, not one combined folder per feature. An import graph of `src/` showed why. Features like tools, export and zoom don't import each other; they meet only in the composition roots (`useAppShell`, `AppShell`, `PhoneSheets`, `AppHeader`). Every feature would also import the shared domain core (Pattern, grid, beads) and the UI primitives. So full feature modules would add folders without adding real boundaries, while subfolders inside the layers still group the files that belong together.

Starting grouping (taken from the import-graph clusters; adjust where a file clearly belongs elsewhere and say why in the PR):

| Folder | Contents |
|---|---|
| `ui/` | AppButton, AppIcon, AppModal, AppSelect, AppSwitch, IconButton, ProgressBar, AppTooltip, form/*, AppMenu*, ToastRegion, AppMessage |
| `canvas/` | PatternCanvas, PatternRuler, PatternSurface, CanvasStrip, CanvasPanel, CanvasBackdrop, ZoomControls, ZoomPill, EmptyCanvas, plus useCanvas*, usePatternZoom, usePinchPan |
| `tools/` | Toolbox, ToolGroup, MirrorControls, ContextBar, AppDock, toolIcons, plus the tool, mirror, paint and selection composables |
| `palette/` | PalettePicker, CustomColorPicker, ImageColorsPicker, ImageColorsButton, BeadQuantities, BeadPill |
| `export/` | QrCode, QrExportPanel, SaveBox, NameOnExportsModal, useExportFlow, useQrExport, useSaveFlow |
| `import/` | PatternImport, ConvertImageFrame, ShrinkCropPicker, useConvertImage, useImportSwitchFlow |
| `shell/` | AppShell, AppHeader, AppSidebar, AppBottomBar, BottomToolbar, PhoneSheets, AppDialogs, AppDrawer, BottomSheet, useAppShell |
| `tour/` | TourLayer, useTour, tourGeometry, tourDom |

The ticket also cleans up the few imports that cross layers in the wrong direction:

- domain/ imports number formatting and the `Locale` type from i18n/. Move both into domain/, so i18n depends on domain and not the other way round.
- A composable imports the `PhoneSheet` type from the `AppDock` component. Move the type somewhere both can import it, such as a domain or composables module.

**Blocked by:** None for the code. Moving about 110 files will conflict with any open branch that touches `components/` or `composables/`. Start once `feat/217` and the open Overview tickets (218–221) are merged, or rebase them straight afterwards. Land it as one PR of its own.

**Status:** done

- [x] ADR 0020 is amended (or a new ADR is added that refers to it) to record the mirrored feature-subfolder layout, the folder list, and the rule that `ui/` imports from no feature folder; it says why colocated feature modules were rejected (features share the domain core and meet only in the composition roots)
- [x] domain/ imports nothing from i18n/; number formatting and the `Locale` type live in domain/ and i18n/ uses them from there
- [x] No composable imports from a component, including types (`PhoneSheet` no longer lives in `AppDock`)
- [x] Every component and composable sits in a feature subfolder; any file left at the top level is listed in the PR with the reason
- [x] Files are moved with `git mv`, so history follows them
- [x] A new ESLint rule fails if anything in `components/ui/` imports from a feature folder; the existing ADR 0020 boundary rules in `eslint.config.js` still match the moved paths (check this by adding a deliberate violation and seeing lint fail)
- [x] Docs that mention moved paths (CLAUDE.md, CONTEXT.md, DESIGN.md, ADRs, `docs/agents/`) are updated where a path would otherwise be wrong
- [x] Typecheck, lint, unit tests and e2e (including the visual tests) pass with no snapshot updates; no behaviour or visual change
- [x] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80), as this is a pure refactor

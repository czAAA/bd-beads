# 266: Sync the local design system with v18

**Status:** done

**What to build:** Copy design system v18 from claude.ai into `docs/design/system/` (DESIGN.md §6) and update the version line.

**Done:** synced top-level files, `components/` (ToolTabs now icon tiles, Frame margin, Message, Toolbox, PaletteSwatches, SaveBox and others); `assets/` and `favicon/` unchanged (the zip ships only stubs for them); `bundle.css` non-token values unchanged, so `design-values.css` needs no edit.

**Left for later:** the `CanvasStrip` card still shows the "pieces outside the Frame" count (see DESIGN.md §4.2); the app's Toolbox and Frame margin already match v18 (tickets 250, 261).

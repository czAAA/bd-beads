# 182: Maker's name: per-Pattern override + canvas watermark

**What to build:** Extend Maker's name so it can optionally be set/overridden per Pattern from the New Pattern form — blank by default regardless of the device-wide value, with a creative placeholder suggesting a name or nickname. When set, render it as background watermark text on the canvas, the same way the Pattern name currently renders as a watermark.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] New Pattern form has an optional Maker's name field, blank by default, with a creative nickname-style placeholder
- [x] Leaving it blank keeps today's device-wide Maker's name behavior for exports unchanged
- [x] Setting it overrides the device-wide value for this Pattern only, on exports and on-canvas
- [x] The per-Pattern Maker's name renders as watermark text on the canvas background, alongside the Pattern name
- [x] CONTEXT.md's "Maker's name" glossary entry updated to describe the per-Pattern override

**Done (ticket 182):** `Pattern.makerName?: string` and `CreatePatternInput.makerName?: string` (`domain/pattern.ts`), normalized through `normalizeMakerName` the same way the device-wide name is, present only when non-empty. The New Pattern form gained a Maker's name field (blank, optional, placeholder "Bead Master" / «Мастер бисера»`t.form.makerNamePlaceholder`) beside Name. `printText()` (`rendering/printText.ts`) now resolves one `maker` (`pattern.makerName || deviceMaker`) that every caller downstream reads — the header's "Made by", the "by {maker}" line and the background watermark all follow the override automatically — and a new `background` field: the maker alone when there's no override (today's behavior, unchanged), or the Pattern's own name joined with it ("{name} · {maker}") when there is one, which is what the background watermark now draws (`drawBackgroundName`, `printPages.ts`/`pngPage.ts`, renamed from taking `maker` to the already-resolved `background`). CONTEXT.md's Maker's name entry describes the override and that it travels with the Pattern (export/import/another device) rather than staying on the device. Covered by unit tests (`pattern.test.ts`, `printText.test.ts`, `NewPatternForm.test.ts`) and the export e2e suite (`e2e/visual/export.spec.ts`).

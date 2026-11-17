# KindLabel

A Release note's kind, **New**, **Changed** or **Fixed**, as a small label beside its line (ticket 1047, spec 1043). One component (`src/components/ui/KindLabel.vue`) for every row of What's new (Homepage card) and for "Update ready" (ticket 1048, Message card).

- **Shape:** drawn as the Demo tag (CanvasStrip card): the word in `meta-small`, lowercase, in the kind's color, on that color at `--kind-label-tint` (12%), `radius-full`, padding 2 8, never wrapped or cut.
- **Colors:** one role-named token per kind, `kind-new` (green), `kind-changed` (blue), `kind-fixed` (violet), in all three themes (`tokens.json`). Each reads at 4.5:1 or more on its own tint over `panel` and `elevated` (light 5.0, 5.1, 5.2; dark 6.9, 5.4, 5.7). They differ in lightness as well as hue, and the word is always there, so the kind never rests on color alone.
- **High contrast:** no fill (`--kind-label-tint` is 0%) and a 1px edge in the kind's color (`--kind-label-edge`), the kind's darker token at 9:1 and more on white.
- **Order:** where several kinds are listed, always New, Changed, Fixed: the biggest first, as a Version steps.
- **Copy:** writing.md, "What's new by Version (ticket 1047)": New, Changed, Fixed; Новое, Изменено, Исправлено; Nuevo, Cambiado, Corregido.
- Not a button and not a filter: it only names the kind.

Hand-written from the claude.ai canvas "Versioning and What's new", artboard "Kind labels · three new colors".

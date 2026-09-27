# 182: Maker's name: per-Pattern override + canvas watermark

**What to build:** Extend Maker's name so it can optionally be set/overridden per Pattern from the New Pattern form — blank by default regardless of the device-wide value, with a creative placeholder suggesting a name or nickname. When set, render it as background watermark text on the canvas, the same way the Pattern name currently renders as a watermark.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] New Pattern form has an optional Maker's name field, blank by default, with a creative nickname-style placeholder
- [ ] Leaving it blank keeps today's device-wide Maker's name behavior for exports unchanged
- [ ] Setting it overrides the device-wide value for this Pattern only, on exports and on-canvas
- [ ] The per-Pattern Maker's name renders as watermark text on the canvas background, alongside the Pattern name
- [ ] CONTEXT.md's "Maker's name" glossary entry updated to describe the per-Pattern override

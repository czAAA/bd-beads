# 56: Store Patterns in a compact grid encoding

**What to build:** A saved Pattern takes a small fraction of the space it does today, so a Pattern library can grow for years without approaching the browser's storage ceiling.

Today every cell is stored as its own object carrying a full hex string. A 60×90 Pattern — 9×13.5cm in 1.5mm cubes, an ordinary size — costs about 100KB, so a 5MB quota runs out at roughly 50 Patterns. Storing each Pattern's distinct colours once and its cells as runs of indexes into that table takes the same Pattern to about 3KB: roughly 1,600 Patterns in the same quota.

- **ADR 0009 is written first**, recording why a compact encoding was chosen over moving to IndexedDB, with the measurements and an explicit trigger for revisiting that choice.
- **The stored format is versioned**, and Patterns saved in today's format are migrated on first read.
- **Each Pattern carries its own colour table**, not indexes into the app's Palette. A cell may hold any hex at all — a Custom colour, or a colour from an imported file that this device's Palette has never had — so a Palette-indexed encoding would destroy those colours silently on the next save.
- **A Pattern's non-grid fields round-trip untouched**, including ones added after this ticket. Ticket 58 adds Image colors: a *frozen* record of what one Convert image found, which is deliberately **not** the same list as this encoding's colour table of the hexes currently in the grid ([ADR 0011](../docs/adr/0011-image-colors-stored-frozen.md)). The two legitimately differ the moment a colour is erased, and folding one into the other — which looks like an obvious deduplication — would silently destroy that feature.
- **Exported Pattern files are unaffected.** They stay readable JSON at version 1, which makes export and import an encode/decode boundary rather than a passthrough.

**Blocked by:** 55 (take saving off the per-cell edit path) — this changes what the save path writes, so it should land on a save path that has already been reshaped

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- **Compact encoding over IndexedDB.** Measured: a 60×90 Pattern goes from 100.4KB to 3.1KB, a 150×200 one from 557.1KB to 16.8KB — a 14–33× reduction — with encode and decode also around 5× faster than the current JSON round trip. IndexedDB would remove the quota ceiling entirely but does nothing whatsoever about size, and costs async plumbing through every call site. **Migrate to IndexedDB if a Pattern library ever approaches the quota despite this encoding, or if save latency becomes visible** — that trigger belongs in ADR 0009, where a future reader will look.
- **Run-length encoding over a raw index array.** RLE is smaller on the blocky designs beadwork actually produces, and never loses to today's format even on a worst-case grid where every neighbouring cell differs. A raw index array would be perfectly predictable at 1 byte per cell, but that predictability only matters near a ceiling this ticket removes. A raw array also pays a 33% base64 tax in localStorage, which only IndexedDB would avoid.
- **A per-Pattern colour table, not the Palette.** Found by checking the encoding against the glossary: CONTEXT.md's Custom colour entry says such cells "keep that color and show up in Bead quantities like any other color", and the code agrees — an arbitrary hex goes straight into the grid, and Bead quantities already handles hexes the Palette doesn't know. A Palette-indexed encoding would have shipped silent data loss.
- **Export files deliberately keep today's readable JSON.** A Pattern file exists to move work between devices and to be inspected; there, legibility is worth more than compactness, and ADR 0001 makes it the only way work moves at all.
- ADR 0009 references ADR 0001 rather than amending it: ADR 0001 decided *that* persistence is local-only, and this decides *how* the bytes are shaped. Amending would blur what ADR 0001 actually decided.

- [ ] A Pattern's stored form carries a per-Pattern colour table and run-length-encoded cells, under a version marker
- [ ] Patterns saved in today's format load unchanged and are rewritten in the new format
- [ ] Round-trip tests cover a Custom colour, an imported Pattern with hexes outside the Palette, a fully empty grid, a single-cell grid, and a grid where every neighbouring cell differs
- [ ] Exported files are byte-identical in format to today's and still import correctly
- [ ] ADR 0009 records the decision, the measurements, and the trigger for moving to IndexedDB
- [ ] A painted 60×90 Pattern occupies roughly 3KB in storage rather than roughly 100KB
- [ ] Full suite green

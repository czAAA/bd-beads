# 15: Move saved Patterns between devices via export/import

**What to build:** Extend the export/import mechanism (ticket 12) so the user can move all their work between two devices: export the entire saved-patterns library (ticket 05), including row-progress state (ticket 13), to one file, and import it on another device/browser to resume exactly where they left off. See [ADR 0001](../../../docs/adr/0001-local-only-persistence.md), which anticipates this as manual file transfer rather than a live sync backend.

**Blocked by:** 05, 12, 13

**Status:** ready-for-agent

- [ ] User can export all saved Patterns (not just the currently open one) to a single downloadable file
- [ ] User can import that file on another device/browser and get back the same saved Patterns, each identical (grid, colors, technique, bead, mappings, row-progress state)
- [ ] Importing adds any Patterns not already present locally rather than silently overwriting; a Pattern with the same identity as an existing local one is imported as a separate entry, not merged over it
- [ ] The whole roundtrip works client-side, without a backend

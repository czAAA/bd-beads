# 08: Export and import a pattern file

**What to build:** User can export the current Pattern (technique, bead, dimensions, painted cells, color mappings) as a file, and import a previously exported file to restore/open it. See [ADR 0001](../../../docs/adr/0001-local-only-persistence.md).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] User can export the open Pattern to a downloadable file
- [ ] User can import that file back into the app and get an identical Pattern (same grid, colors, technique, bead, mappings)
- [ ] The whole roundtrip works client-side, without a backend

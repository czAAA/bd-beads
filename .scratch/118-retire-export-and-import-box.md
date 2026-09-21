# 118: Retire the "Export and import" box

**What to build:** With QR export in the Edit group (ticket 116) and Import in the top bar (ticket 117), only the two file exports remain in the below-canvas "Export and import" box. Export pattern (downloads the open Pattern as a file) and Export library (downloads every saved Pattern) move into the Saved Patterns box, and the Export and import box goes away. The below-canvas panel is then two boxes: Beads needed and Saved Patterns.

Export pattern stays disabled with no Pattern open, and Export library with an empty library, as today. Filenames and file contents are unchanged.

**Blocked by:** 116 (QR export in the Edit group), 117 (Import and New Pattern in the summary group)

**Status:** ready-for-agent

- [ ] Export pattern and Export library are in the Saved Patterns box, with today's enabled/disabled rules and unchanged downloads
- [ ] The Export and import box no longer exists; the below-canvas panel shows Beads needed and Saved Patterns
- [ ] Any transfer heading/label strings no longer used are removed in EN and RU
- [ ] ADR 0004's below-canvas amendment (ticket 39's three-box list) and CONTEXT.md updated to the two-box panel
- [ ] Tests for both exports carried over to their new home

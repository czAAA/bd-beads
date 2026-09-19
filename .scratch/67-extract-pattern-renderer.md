# 67: Extract reusable Pattern-to-image rendering (prefactor)

**What to build:** Pull the logic that renders a Pattern's grid (its cells, shapes per Technique/Bead form factor, and Palette colors) into one shared, reusable module, so the upcoming PNG and PDF exports both build on it instead of each reimplementing "draw this Pattern" independently.

**Blocked by:** 65 (Codebase architecture review — needs the module boundaries decided first)

**Status:** ready-for-agent

- [ ] A single rendering function/module produces a rendered image of a Pattern (respecting Technique, Bead form factor, and Palette/Image colors)
- [ ] Existing on-screen canvas rendering is unaffected
- [ ] The new module has test coverage for at least one Technique and one edge case (e.g. an unpainted Pattern)

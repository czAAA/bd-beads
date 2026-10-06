# 318: One Project renderer for both spaces

**What to build:** ADR 0018 promises one Project renderer, but there are two. The editor draws only through `renderCanvas` (`rendering/canvasRenderer.ts`, the open canvas), while the PNG/PDF exports, the Convert image preview and the Overview draw through `renderProject` (`rendering/projectRenderer.ts`, the Frame alone). About 60 lines are copied between them, and the copies have drifted. The tests sit on the wrong one: `renderProject` has 66, `renderCanvas` 1, and the editor's band redraw (`rows`) has none. The overlay already knows the two cases through a private `Space` / `spaceOf` in `overlayRenderer.ts`, but all 37 of its tests run the closed (Frame-only) space, which only the Overview uses.

Make one `renderProject` that takes a space and decides extent, origin, which rows and columns to visit, empty positions, seams, background and the band redraw itself:

- **Shared `Space`.** Move `Space` and `spaceOf` out of `overlayRenderer.ts` into an exported module in `rendering/`. `ProjectSurface` and the Overview build it once and hand the same value to the renderer and the overlay, so base layer and overlay can't disagree about where positions are.
- **Delete `canvasRenderer.ts`.** `viewArea`, `setViewTransform` and `OPEN_EXTENT` move beside `regionInGridSpace` / `setGridTransform`. Leave the transform helpers otherwise as they are: candidate A3 (Surface view) will absorb them later, and this ticket doesn't wait for it.
- **What differs by space, and only this:** the background (Frame-only fills `theme.background`; open leaves the surface transparent for the technique word behind, and finished rows fade toward `theme.canvas`), and empty positions (open draws the dots outside the Frame and leaves the Frame's keep-out margin as a gap; Frame-only has none).
- **One seam rule:** a brick seam runs between two rows of the Frame, across the Frame. An open canvas with no Frame has no seams. The band's top seam pixel follows the same rule (today `renderProject` checks `rows.first > 0`, `renderCanvas` doesn't).
- **One hex parser.** Four places parse `#rrggbb` on their own: `fromHex` in `domain/imageColors.ts`, the private `parseHex` in `rendering/beadLook.ts`, `draftRenderer.ts` (which also accepts `#rgb`), and `projectThumbnail.ts`. Move `fromHex` to a new `domain/color.ts` that accepts `#rgb` and `#rrggbb` and returns `undefined` for anything else, and use it at all four. Callers that need a fallback for bad input keep their own.

Two bugs go away by construction; give each a regression test:

1. **Brick seams never fade in Frame-only space when the Frame doesn't start at column 0.** `renderProject`'s `isRowFinished` asks `isInFinishedRow` about absolute column 0, which is outside such a Frame, so it is always false. The seam's finished state must be asked about a position inside the Frame.
2. **A Project with no Frame whose top bead is on an odd row draws its half-bead offset flipped outside the editor.** `renderProject` and the closed overlay shift rows by their number inside the Frame; the editor shifts by the absolute row. Frames are always snapped to an even top row (`snapRow`), but the no-Frame fallback (`beadBounds` in `projectFrame`) isn't. The row shift follows the absolute row in both spaces, so the export looks like the editor.

No other visible change: the refactor is pixel-neutral apart from those two fixes. Candidate A1 of the architecture review of 2026-10-05. ADR 0018 is restored, not changed, so no new ADR.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] One `renderProject` taking a shared `Space` draws the editor, the exports, the Convert image preview and the Overview; `canvasRenderer.ts` is gone
- [ ] `Space` / `spaceOf` are exported from one module in `rendering/`, and the overlay takes the same value as the renderer
- [ ] Renderer tests are a table of space (open, Frame-only) × Technique, with rotation where it matters, and cover the band redraw in both spaces
- [ ] Overlay tests gain open-space cases for what the editor uses: Row progress marker, Selection, hover preview, cursor
- [ ] Regression tests for the two bugs above: seam fading with a Frame past column 0, and row shift parity for a no-Frame Project whose top bead is on an odd row
- [ ] One `fromHex` in `domain/color.ts` (accepting `#rgb` and `#rrggbb`) replaces the four parsers, with its own tests
- [ ] ADR 0026's wording about the open canvas renderer and CONTEXT.md's "Project renderer" entry say it is one renderer over two spaces
- [ ] The visual check passes; the PR names any screenshot it updates and why
- [ ] Typecheck, lint, unit tests and the visual check pass in CI

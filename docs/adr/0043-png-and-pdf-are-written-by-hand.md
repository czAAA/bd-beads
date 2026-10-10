# PNG and PDF exports are written by hand, with no export library

**Status: accepted.** Tickets 73, 74.

Exports draw with the Project renderer ([ADR 0018](0018-pattern-drawn-by-one-renderer-not-a-dom-cell-per-bead.md)), so an exported bead looks like the one on screen, and must work at any size ([ADR 0019](0019-a-pattern-has-no-size-limit.md)), past what one browser canvas holds (iPad Safari's limit is about 16 megapixels).

- **PNG is written strip by strip** (`domain/pngEncoder.ts`): the caller draws a band of rows at a time, each is compressed as it arrives with the browser's own `CompressionStream` ("deflate" is the zlib format PNG data uses), and only compressed bytes are kept.
- **PDF is whole-page pictures** (`domain/pdfDocument.ts`): every page is drawn on a canvas, text included, and laid in as one JPEG. Any language the app speaks prints the same, with no font to embed.
- Exports always use the light theme ([ADR 0021](0021-visual-language-follows-design-md.md)).

The app's only runtime dependency is Vue.

**Considered options**: a PNG library or `canvas.toBlob` on one big canvas (rejected: the one-canvas size limit is the problem); a PDF library with embedded fonts (rejected: a large dependency, and a font per script for every language, [ADR 0039](0039-languages-and-how-they-are-written.md)); vector PDF text (rejected: same font problem).

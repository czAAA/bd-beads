# QR sharing is capacity-capped to the compact encoding; unlimited size is a paid, link-based feature later

Extending Pattern portability with a QR export (alongside the existing JSON Pattern file, plus new PDF and PNG exports) runs into a hard limit: a single QR code holds roughly 2.9KB, while an exported Pattern file deliberately keeps the verbose, human-readable JSON shape (ADR 0009) — an ordinary 60×90 Pattern is 103KB there. QR export therefore encodes the Pattern using the same compact run-length color-table encoding ADR 0009 already uses for localStorage, not the verbose export format, to fit as much as possible into one code. A Pattern that still doesn't fit falls back to the existing file export with a message, rather than being blocked or silently truncated.

Once the hosted backend exists (ADR 0014), a paid plan gets a second option: the QR encodes a link to a hosted copy instead of the data itself, removing the size ceiling entirely. This is deliberately not built at MVP, since it depends on the backend ADR 0014 defers.

**Considered options**: chunking a large Pattern across multiple QR codes scanned in sequence (rejected for now — works at any size with no backend, but a fussier scan flow for uncertain benefit; worth revisiting if the size cap proves too tight in practice).

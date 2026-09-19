# 68: QR export: compact-encoded, size-capped, file-export fallback

**What to build:** Add a QR-code export option for a Pattern, encoding it with the app's existing compact run-length color-table encoding (ADR 0009) rather than the verbose Pattern-file JSON, so it fits within a single QR code's capacity. When a Pattern is too large to fit, show a clear message and fall back to the existing Pattern-file export instead of failing silently or truncating. See ADR 0015.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A Pattern within the size cap exports as a single scannable QR code
- [ ] Scanning/importing that QR code on another device reproduces the Pattern exactly
- [ ] A Pattern over the size cap shows a clear "too large for QR" message and offers the existing file export instead

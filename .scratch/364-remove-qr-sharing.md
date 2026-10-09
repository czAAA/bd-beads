# 364: Remove QR sharing entirely

**What to build:** Take QR sharing out of the app: QR export, QR import from a picture, the `#pattern=` link that carries a Project's data, and the `qrcode` and `jsqr` dependencies. Sharing becomes the Project file now and the View link later (ADR 0014, ADR 0037). There are no users yet, so old QR codes and `#pattern=` links stopping working is accepted. ADR 0015 is already deleted; this brings the code in line.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] QR export (`useQrExport`, `QrExportPanel`, its control registry entry, its place in the Export menu and the phone sheets) is gone
- [ ] QR import from a picture is gone, with its Import entry
- [ ] `useSharedProjectLink` and the `#pattern=` reader and writer are gone; `domain/qrExport.ts` is gone
- [ ] `qrcode` and `jsqr` are removed from `package.json`, and knip is clean
- [ ] Every QR string is removed from every language; the design system's cards and DESIGN.md drop the QR dialog and QR export
- [ ] The stored-data compatibility test drops the `bd-beads/qr-pattern` kind and the `#pattern=` hash; ADR 0028's list already has
- [ ] CONTEXT.md no longer mentions QR (Pattern, Tool group, and any other entry)
- [ ] Every remaining `ADR 0015` citation is gone with the code it sat in; ADR 0031 and ADR 0043 drop their "until ticket 364" notes
- [ ] The ticket is archived in the same change

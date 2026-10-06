# 309: Test that a real version 1 QR code still opens

**What to build:** QR codes already printed or shared in the wild carry the version 1 payload, from before the Open canvas (ADR 0026): a dense `cells` grid, not the current `beads`. The only "old payload" test in `src/domain/qrExport.test.ts` ("still reads the bare JSON an earlier build wrote to its codes") wraps a payload made by today's `encodeProject` in `version: 1`, so it never reads a real v1 body, and `compatibility.test.ts` covers the library and Project files but not QR. Add fixtures for real v1 QR payloads, taken from what the encoder produced at the time (recover the format from git history of `qrExport.ts` and `projectEncoding.ts`), both as bare JSON and as the app link form, and check that they open as the expected Project (with the Frame the size of the old grid, per CONTEXT.md). If one doesn't open, fix the reading path. Found in the architecture review (bug 6; candidate D3 later gives every historic shape one reading module).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Fixtures hold real v1 QR payloads (dense `cells`, at least one non-loom Technique and one with Row progress), in the shape the old encoder wrote, with a comment naming the commit they come from
- [x] Both the bare JSON and the link form of each fixture open as the expected current Project through `parseProjectFromQr` (what importing a QR picture calls), and the link form also through `projectFromShareLink` (what a camera scan of the code lands on)
- [x] The misleading existing test is renamed or replaced so its name matches what it checks
- [x] Any reading bug the fixtures expose is fixed in the same change

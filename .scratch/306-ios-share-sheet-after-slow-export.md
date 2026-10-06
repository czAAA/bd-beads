# 306: PNG and PDF exports open the iOS share sheet from a fresh tap

**What to build:** On iPhone and iPad, `services/fileDownload.ts` prefers `navigator.share` (Save to Files, AirDrop) and says that nothing may await before calling it, because Safari allows sharing only straight from a tap. `useExportFlow.runExport` (`src/composables/export/useExportFlow.ts:63`) breaks that rule: it calls `downloadFile(…, await make(…))`, and drawing a PNG or PDF takes seconds. By then the tap is spent, `share` is likely refused, and the code falls back to a download link, which in-app browsers (Telegram and the like) ignore, so the export seems to do nothing. The Project file and library exports don't await and aren't affected.

Fix: when the file had to be made first and the device takes the share path, show a toast with an action ("PNG ready · Save" / "PDF ready · Save", using the existing `useToasts` action) once the file exists, and call `navigator.share` directly in that action's tap handler. Desktop and Android keep downloading straight away. Copy in English and Russian. Found in the architecture review (bug 2; candidate E2 later moves this rule into one export module).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A unit test with a fake download adapter (no module mocks of `fileDownload`) shows that on the share path `navigator.share` is called only inside the toast action's handler, never after an await in the export click
- [ ] On the share path, the toast appears once the PNG/PDF is ready, and its action opens the share sheet; dismissing the toast shares nothing
- [ ] Off the share path (desktop, Android, or no `canShare` for files), the file still downloads as soon as it is made, with no toast
- [ ] The Project file and library exports are unchanged
- [ ] Copy exists in English and Russian, fits at 320px (text fit check passes)
- [ ] Left for a human: confirm on a real iPhone, in Safari and in an in-app browser, that the share sheet opens

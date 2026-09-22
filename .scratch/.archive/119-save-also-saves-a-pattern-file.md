# 119: Save also saves a Pattern file

**What to build:** The Toolbox's Save (and Ctrl/Cmd+S) writes to this device as before and also hands over the open Pattern as a Pattern file, so it can be opened on the next device. On iPhone and iPad the file is offered to the share sheet ("Save to Files") where the browser can share it, because in-app browsers such as Telegram's often ignore download links; otherwise, and if sharing fails, it downloads through a link. The file goes out even when the device refuses the write.

**Status:** done

- [x] Save hands over the open Pattern as a Pattern file named after it
- [x] The file is handed over even when the write to the device is refused, and "Saved" is still not shown then
- [x] The download helper is shared with the Export buttons (`src/domain/fileDownload.ts`)
- [ ] Verified on a real iPad in Telegram's in-app browser (share sheet path untested outside unit tests)

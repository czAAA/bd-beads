# 115: Save tool in the Edit group

**What to build:** A Save control in the Toolbox's Edit group. Edits already save themselves to this device (ADR 0012), so Save is a reassurance rather than a new kind of storage: pressing it writes any pending change to the device immediately and shows a brief "Saved" confirmation, in both languages. If the device refuses the write, the existing "couldn't save" notice in the top bar shows and the "Saved" confirmation does not, so Save never claims something that isn't true.

Save has a keyboard shortcut (Ctrl/Cmd+S, which must not trigger the browser's own save-page dialog) and is listed in the shortcuts help, like the other Toolbox controls. It is available whenever a Pattern is open.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Edit group has a Save control with an icon, a tooltip naming its shortcut, and an accessible name, in EN and RU
- [ ] Pressing it writes any pending change to the device and shows a brief "Saved" confirmation that goes away by itself
- [ ] When the write is refused, the "couldn't save" notice shows and the "Saved" confirmation does not
- [ ] Ctrl/Cmd+S does the same and suppresses the browser's save-page dialog; it does nothing while a modal is open or when no Pattern is open
- [ ] The shortcuts help lists Save
- [ ] Tests cover success, refused write and the shortcut

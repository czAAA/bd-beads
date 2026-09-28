# 178: Beads needed header format + Progress bar row keybinds

**What to build:** Change the Beads needed header from "15 ~ 0.16g" to "15×{count}~0.16g (i)", moving the info tooltip trigger to sit next to "g". Separately, add a Space keybind to mark the current row done, and Shift+Space to mark it not done, in the Progress bar.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Beads-needed header renders "15×{count}~0.16g (i)" with the tooltip icon immediately next to "g"
- [ ] Space marks the current row done (same effect as clicking Row done)
- [ ] Shift+Space marks the current row not done (same effect as clicking Row not done)
- [ ] Keybinds respect Row progress's existing locking rules (no-op when Row progress is off)
- [ ] Keybinds don't fire while focus is in a text input

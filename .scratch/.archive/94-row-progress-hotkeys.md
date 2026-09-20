# 94: Row progress group hotkeys

**What to build:** `P` toggles Row progress on/off, `D` toggles Row direction, `Enter` moves to the next row, `Shift+Enter` moves to the previous row — the same effect as clicking those Row progress buttons.

**Blocked by:** 86 (Table-driven keyboard-shortcut dispatcher)

**Status:** done

- [ ] `P` toggles Row progress enabled
- [ ] `D` toggles Row direction
- [ ] `Enter` / `Shift+Enter` move to the next/previous row, respecting the existing disabled bounds at the first/last row
- [ ] `Enter` / `Shift+Enter` are suppressed when focus is on a Toolbox button, so Tab+Enter doesn't both click that button and move the row
- [ ] Every control's tooltip shows its shortcut

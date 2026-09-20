# 90: Del key — activate Erase, or clear the selected cells

**What to build:** Pressing `Del` is context-sensitive. If Select is the active tool and a Selection exists, `Del` clears that Selection's cells (one new Undo step, respecting the Row progress lock and honoring Mirror, same as any other drawing command) and stays in Select. Otherwise (no Selection, or a different tool is active), `Del` activates the Erase tool.

**Blocked by:** 86 (Table-driven keyboard-shortcut dispatcher), 89 (Erase tool)

**Status:** ready-for-agent

- [ ] `Del` with Select active and a Selection present clears the selected cells only, as one Undo step, respecting the Row progress lock and Mirror
- [ ] The Selection itself remains after clearing (only its contents change); Select stays the active tool
- [ ] `Del` with Select active and no Selection activates Erase
- [ ] `Del` with any other tool active activates Erase
- [ ] No effect while typing in a form field or while a confirm modal is open

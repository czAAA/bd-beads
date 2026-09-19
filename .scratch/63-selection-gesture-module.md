# 63: Extract the Select/Copy/Paste gesture into its own module

**What to build:** The Select tool's whole gesture — marking out a Selection, Copy, and Paste (including the click-vs-drag ambiguity a Select press resolves) — moves out of the app shell into one place, behind a small interface, dispatched only while the Select tool is active. No visible change: the same marquee, the same Copy/Paste behaviour, the same undo step per Paste.

**Blocked by:** 62 — this module (`useSelectionGesture`) reads Mirror's axis counts and copy mode from ticket 62's extracted module rather than from the app shell directly.

**Status:** ready-for-agent

**Decisions (2026-09-19):** — from the same architecture review as ticket 62 (see ADR 0013 for a related rejected candidate)
- Selection, the clipboard, the in-progress press, and Select's own hover preview (what a hovered cell would show under Paste) all move together.
- Paste commits through the existing shared grid-change/undo path (the same one Fill and "Mirror current" use), not a private copy.
- Escape and right-click precedence against confirmation modals and an expanded Tool group stays in the app shell, which calls this module's cancel step last.
- Selection/clipboard state still resets through the app shell's existing single reset point on a Pattern switch.
- The module never branches on which tool is active — the app shell decides whether to call into it at all.
- This candidate's evidence held up under scrutiny: tickets 31, 49, and 50 each directly and substantively edited this exact code.

- [ ] Selection, clipboard, press-tracking, and the Select-tool hover preview live in one module, not the app shell
- [ ] Paste still commits as one undo step through the existing shared path
- [ ] Escape/right-click precedence against modals and an expanded Tool group is unchanged
- [ ] Selection/clipboard still reset on a Pattern switch
- [ ] Mirror inputs (axis counts, copy mode) come from ticket 62's module
- [ ] Every existing Select/Copy/Paste test passes unchanged
- [ ] A new test file covers the extracted module directly

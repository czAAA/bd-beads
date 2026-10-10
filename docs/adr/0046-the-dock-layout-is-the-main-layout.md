# The Dock layout is the main layout; the Toolbox layout is kept behind a flag

**Status: accepted.** Ticket 383. Amends [ADR 0032](0032-everything-under-1024px-is-the-phone-layout.md). Layout detail: `docs/layout.md`.

The layout people know from a phone or an iPad held upright (the canvas first, a Dock below it, sheets for the controls) is the layout for everyone, at every width. The wide layout (a header, the left column and the Toolbox, from 1024px) is the **Toolbox layout**; it is kept, not deleted. "Phone layout" and "desktop layout" no longer name anything, because the first now runs on a desktop.

- **One flag, `DOCK_LAYOUT_ENABLED` in `src/features.ts`** ([ADR 0041](0041-switched-off-features-live-in-features-ts.md)), default on. Off restores the Toolbox layout above 1024px and ADR 0032's split exactly as it was.
- **A layout class on the shell.** A media query cannot read a constant, so `AppShell` carries `app-shell--dock` while the flag is on and the layout CSS keys on it; the width rules stay for the flag-off case. With the flag on the header and the Toolbox column are not mounted.
- **The Canvas strip stays** in the Dock layout at every width, one slim row: title, size line, keyboard hint and the Canvas color picker. The zoom buttons and the Rulers toggle are not repeated in it, because the Zoom pill owns them. The picker leaves the Project sheet header. This is the part of ADR 0032 that is reversed.
- Menus open as sheets at every width. The Overview is untouched.

**Considered options**: a runtime switch (rejected: every media query would need a script-driven class); deleting the Toolbox (rejected: the owner wants to compare and go back at no cost).

**Consequences.** A touch layout on large screens is traded against the Toolbox's directness: one more tap per tool change with a mouse. The strip costs height on short landscape screens, which is accepted. The unit suite runs the Toolbox layout by default (most App tests drive the Toolbox's controls); `src/App.dockLayout.test.ts` runs both values of the flag. Sharing one set of tool, colour and Edit controls between the Toolbox and the sheets is not done here; it is a follow-up ticket.

# Glossary: Accounts and sharing

Guest, Free account, Pro, View and Edit links, Locked Project. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**View link**:
A hosted, encrypted snapshot of a Project that a Guest or any account can create. The key is in the part of the link after `#`, so the backend never sees the Project; opening it shows the Project and can import it. Later edits don't change it and it can't be used to edit. It expires 3 days after it was last opened, and every open restarts the clock; an expired link is gone, and the Project has to be shared again, as a new link.
_Avoid_: share link, public link

**Guest**:
Someone using the app without signing in. Everything that works on the device works for a Guest, with no limit on Projects or their size; only what needs the backend is offered by account.
_Avoid_: anonymous user, visitor

**Free account**:
A signed-in person with no paid plan. Gets what needs little of the backend: the basic settings kept in step across their devices, and one synced Project. The exact set is decided by plan, not fixed here.
_Avoid_: basic plan, member

**Pro**:
The paid plan, for someone who would rather not manage their work on each device: what needs more of the backend, such as many synced Projects and Palettes saved to the account. Never needed for anything that works on the device; every feature that runs on the device is there for a Guest too.
_Avoid_: premium, subscriber, paid user

**Edit link**:
For a synced Project (a Free account's one, or a Pro's), the link whose `#` part is the Project's key; opening it on a device gives that device the same editable Project. Whoever holds it can read and edit the Project.
_Avoid_: sync link, invite link

**Locked Project**:
A synced Project listed on a signed-in device that doesn't yet hold its key; it opens only after the Edit link is opened there.
_Avoid_: encrypted Project, hidden Project

**Surface view**:
How a bead and a point on screen map onto each other, in both directions: where a bead or a block of beads is drawn, which bead is under a point, where to scroll to centre or fit a block, and how far one step along a row and one down are. Built from a Space, the Technique, the rotation, the zoom and the scroll, and the one place that knows about turning, the row shift and the row pitch. It measures the drawing, not the piece: brick stitch's 1px seam between rows exists only in the drawing, so a Surface view's rows are a pixel further apart than the physical geometry Convert image samples with (ADR 0010, amended).
_Avoid_: hit test, canvas view, grid geometry

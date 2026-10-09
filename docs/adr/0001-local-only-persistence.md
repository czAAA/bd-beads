# Local-first: every Project lives on the device, and an account only adds what needs the backend

**Status: accepted.**

bd-beads is a bead artwork tool for artists and creative people: friendly to a beginner, with the features a professional needs. It is built for the phone and the iPad with an Apple Pencil first, and works as well with a mouse.

Every Project lives in the browser of the device it was made on (localStorage, [ADR 0009](0009-compact-grid-encoding.md), [ADR 0012](0012-saving-follows-the-pattern-library.md)), and the app is fully usable with no account and no network: a **Guest** (CONTEXT.md) can create, edit, save, export and import as many Projects, of any size, as the device holds. The Project file is the backup, and the way work moves between devices without an account.

The backend only adds what cannot run on one device: View links, synced Projects, settings kept in step across devices and saved Palettes ([ADR 0014](0014-mvp-stays-local-only-hosted-phase-deferred.md)). A **Free account** and **Pro** differ only in how much of the backend they use; nothing that runs on the device is ever held back by plan or by account. Whatever leaves the device as a drawing is encrypted first ([ADR 0037](0037-projects-are-encrypted-in-the-browser-the-link-is-the-key.md)).

Touch and Pencil first means nothing needs hover: a Tooltip is help, never the only way to a control or its state, on every layout ([ADR 0032](0032-everything-under-1024px-is-the-phone-layout.md)).

**Considered options**: a server-side library with accounts from the start (rejected: an account becomes the price of trying the app, and the backend's cost and outages become the editor's); limiting the device library to push people to Pro (rejected: it holds back something that costs nothing to run).

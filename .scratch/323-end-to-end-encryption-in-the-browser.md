# 323: End-to-End Encryption in the Browser

**What to build:** The browser encrypts a Project before it leaves the device, so the backend only ever stores and returns ciphertext and can never read a drawing. The decryption key is a random value carried in the part of the link after `#`, which browsers never send to a server. There is no password-derived key, no recovery key and no key escrow: the link is the key. See ADR 0035.

Two halves, built in this order:

1. **View link, for everyone (no login).** Any person can turn a Project into a **View link**: a hosted, encrypted snapshot under its own random key. Opening it shows the Project and offers to import it into the opener's library. Needs the backend (71) but no account or plan.
2. **Edit link and sync, for logged-in Pro users only.** A synced Project is stored encrypted under the account. Its **Edit link** opens the same Project on another device, which is how a person edits one canvas from several devices. A device signed in to the account but without the key lists the Project as a **Locked Project** until the Edit link (or its QR) is opened there. A lock icon appears in the canvas header.

**Blocked by:** 71 (Provision backend infra) for both halves; 78 (Accounts + paired sync) and 84 (Payment integration + plan gating) for half 2 only.

**Status:** needs-triage

## Behaviour

- **Encryption:** AES-256-GCM through the browser's Web Crypto API only, no third-party crypto library. One fresh random key per View link and per synced Project. Everything that describes the Project is encrypted: bead grid, Palette, Project name, maker's name, Frame, Technique. The server sees only an opaque blob ID, the ciphertext size, timestamps and (for sync) the account. The ciphertext size reveals roughly how big a Project is; ADR 0035 accepts that.
- **View link** is a snapshot: later edits don't change it, and it can never be used to edit or to derive the Project's own key. Free users can't list or revoke one (there is no account to own it), so the link has a size cap and anonymous upload limits against abuse. Ticket 85 keeps the paid, unlimited-size part.
- **Edit link** (Pro): last write wins for the whole Project. The server rejects a write based on a stale version and the losing device is offered its copy as a new Project. Live co-editing is a future Pro feature, not here.
- **Stop sharing** (Pro): generates a new key, re-encrypts the Project and invalidates the old Edit link. The popover warns that this person's other devices show the Project as locked until the new link is opened there.
- **Lost link:** if every device and every copy of the Edit link is gone, the Project cannot be recovered, by anyone. A one-time notice when a Project first syncs says so and offers "Copy edit link". The existing file export stays as the backup that doesn't depend on the link.
- **Lock icon** (Pro, signed in, Project synced): in the right slot of the canvas header, after the Fit icon, with a Tooltip. It shows two states, encrypted and synced, and sync problem or key missing. It never shows for a local-only Project or when signed out. Clicking it opens the README chapter on encryption. Add a lock icon to the design system in place (`docs/design/system/`, `DESIGN.md` §6) in the same commit; it has none today.
- **README chapter** describing in plain words what is encrypted, what the server can still see, what the link is, and what losing it means.

## Acceptance

- [ ] A test asserts that the payload sent to the backend contains none of a Project's bead data, Palette, names, maker's name or Frame, in plain or encoded form
- [ ] Any user can create a View link without logging in; opening it on another device shows the Project and can import it; the key is only in the `#` part and never in a request URL, header or body
- [ ] The View link is a snapshot with its own key and cannot be used to edit the Project or recover its key
- [ ] A signed-in Pro user can sync a Project, open its Edit link or scan its QR on a second device, and edit the same canvas there
- [ ] A signed-in device without the key lists the Project as locked and shows how to unlock it
- [ ] A stale write is rejected and the losing device can keep its copy as a new Project
- [ ] Stop sharing re-encrypts under a new key, the old link stops working, and the warning shows before confirming
- [ ] The first-sync notice appears once with "Copy edit link"
- [ ] The lock icon shows only for a signed-in, synced Project, in the canvas header after the Fit icon, with the two states, a Tooltip, and a click that opens the README chapter; the lock icon is added to the design system
- [ ] Web Crypto only: no new runtime dependency (knip clean)
- [ ] README chapter written; CONTEXT.md terms (View link, Edit link, Locked Project) used in the UI copy in EN and RU
- [ ] Tickets 82 and 85 reference this ticket, and 85 is blocked by it

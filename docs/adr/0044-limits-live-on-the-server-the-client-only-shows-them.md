# Limits live on the server; the client only shows them

**Status: accepted, not built.** Tickets 69, 381; applies to 71, 78, 84, 323.

The code is public ([ADR 0031](0031-public-agpl-3-license.md)) and runs in the user's browser, so anything enforced only in it can be edited away. The app doesn't try to prevent that. Two kinds of feature:

- **Runs on the device** (every drawing feature): not guarded. A person who edits the code gets what a Guest already gets for free ([ADR 0001](0001-local-only-persistence.md), [ADR 0014](0014-mvp-stays-local-only-hosted-phase-deferred.md)); there is nothing to take.
- **Costs money or touches other people** (View links, synced Projects, saved Palettes, accounts): the Worker enforces every limit on every request. The plan comes from the payment webhooks and is read on the server, never sent by the client; count and size quotas are per account; rate limits apply per IP and per account; a View link expires 3 days after it was last opened; there is a hard storage cap. The client shows the limits (a message, a mark) but nothing trusts it.

Because drawings are encrypted in the browser ([ADR 0037](0037-projects-are-encrypted-in-the-browser-the-link-is-the-key.md)), a modified client can only damage its own data: the server never reads or trusts a drawing.

Sync follows Excalidraw's convention for end-to-end encrypted data: records carry a `version` and a random `versionNonce` (the higher version wins, the lower nonce breaks a tie), deletions stay as tombstones, and a push built on a stale server version makes the client pull, merge and push again. The server never merges. The unit is a row of the Pattern and one record for each other part of a Project.

**Considered options**: obfuscating or licence-checking the client (rejected: it can't hold against a public, modifiable client, and it fights AGPL); Yjs or Automerge (rejected: character-level merging we don't need, and a heavy dependency); whole-Project last-write-wins (rejected: two devices editing different rows would lose one side's work).

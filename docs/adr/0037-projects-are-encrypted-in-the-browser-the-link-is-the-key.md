# Projects are encrypted in the browser, and the link is the key

**Status: accepted, not built.** Ticket 323.

Once a Project leaves the device, as a View link or a synced Project ([ADR 0014](0014-mvp-stays-local-only-hosted-phase-deferred.md)), the browser encrypts it with AES-256-GCM through Web Crypto first, and the backend stores only ciphertext. The key is a random value in the URL fragment after `#`, which browsers never send to a server, so the server cannot read any drawing.

- **Each Project has its own key.** A View link is a snapshot under its own key; a synced Project's key is in its **Edit link**, which is how another device gets it. A signed-in device without the key lists the Project as a **Locked Project** until its Edit link is opened there.
- **No recovery key, no password-derived key, no escrow.** A lost link with no device that still holds the key means the Project is gone; the Project file is the backup that doesn't depend on it. This is accepted so that "the backend never sees a drawing" is true by construction and asks the artist to handle no keys.
- **The promise is about drawings.** The server still sees an opaque blob id, the ciphertext's size (roughly how big a Project is), timestamps, for synced Projects the account, and the settings kept in step for an account, which are stored unencrypted.

**Considered options**: a passphrase-derived key (rejected: a forgotten password loses data); a device key with a printed recovery key (rejected: manual key handling for people who just want to draw); one account-level key for the whole library (rejected: it needs one of the key-management schemes above); server-held escrow (rejected: breaks the promise); a third-party crypto library (rejected: Web Crypto is in every supported browser and adds nothing to audit).

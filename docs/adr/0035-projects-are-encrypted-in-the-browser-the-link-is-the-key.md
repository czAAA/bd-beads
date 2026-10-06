# Projects are encrypted in the browser and the link is the key

Once a Project leaves the device (a View link for anyone, Edit-link sync for logged-in Pro users), the browser encrypts it with AES-256-GCM through Web Crypto before sending it, and the backend stores only ciphertext. The key is a random value in the URL fragment after `#`, which browsers never send to a server, so the server cannot read any drawing. Server-side sync needs login and the Pro plan; encrypting for a View link needs neither.

There is no recovery key, no password-derived key and no key escrow. A lost link with no device that still holds the key means the Project is gone; the file export is the backup that doesn't depend on it. This is accepted so that "the backend never sees a drawing" is true by construction and needs no manual key handling from the artist. The server still sees an opaque blob ID, the ciphertext size (roughly how big a Project is), timestamps and, for synced Projects, the account.

**Considered options**: a passphrase-derived key (rejected: the password becomes the key and a forgotten one loses data); a device key with a printed recovery key (rejected: manual key handling for people who just want to draw); server-held escrow (rejected: breaks the promise); a third-party crypto library (rejected: Web Crypto is in every supported browser and adds nothing to audit).

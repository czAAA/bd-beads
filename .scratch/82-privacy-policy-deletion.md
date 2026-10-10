# 82: Privacy policy + account-deletion flow

**What to build:** A privacy policy covering what account data is stored, and an in-app flow for a user to delete their account and all associated data.

**Blocked by:** 78 (Accounts + paired-accounts cross-device sync)

**Status:** ready-for-agent

- [ ] A privacy policy page exists and accurately describes what's collected/stored
- [ ] A signed-in user can request deletion of their account and data from within the app
- [ ] Deletion actually removes the account's data from the backend/database
- [ ] The policy states that synced Projects are end-to-end encrypted (ticket 323) and what the backend can still see
- [ ] The policy says that Projects, settings and every preference live in the browser on the device, that the app works with no account and no network, and that the app asks the browser to keep that data from being cleared (ticket 69)
- [ ] The policy says what is kept on the server when hosting is used (account, plan status, settings kept in step, encrypted blobs and their size and timestamps) and that when the server can't be reached nothing on the device is lost, and nothing is sent later except by a signed-in account's own synced Projects

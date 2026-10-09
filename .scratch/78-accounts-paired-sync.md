# 78: Accounts, and basic settings kept in step across devices

**What to build:** A person can create an account and sign in, and a signed-in person's basic settings (theme, language, maker's name) are the same on every device they sign in on (ADR 0014). Settings are stored unencrypted, since they are not drawings (ADR 0037); synced Projects are ticket 323's second half, and Palettes saved to the account are ticket 366's.

**Blocked by:** 71 (Provision the backend host and database)

**Status:** ready-for-agent

- [ ] A person can create an account, sign in and sign out; everything that works on the device works the same signed out (ADR 0001)
- [ ] A setting changed on one signed-in device shows on another signed-in device of the same account
- [ ] No account can read another account's settings
- [ ] The account terms (Guest, Free account, Pro) from CONTEXT.md are used in the UI copy in every language
- [ ] The ticket is archived in the same change

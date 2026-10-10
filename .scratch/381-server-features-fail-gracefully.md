# 381: A feature that needs the server says so and keeps your work safe when it can't be reached

**What to build:** Everything that runs on the device keeps working with no internet or when our hosting is down (ticket 69). The features that need the backend (View link, sync, login, saved Palettes, settings kept in step; none are built yet) must fail the same gentle way, through one shared mechanism rather than each feature's own handling (ADR 0014, ADR 0020).

**Blocked by:** 69 (the offline shell); built together with the first backend feature (71, 323, 78)

**Status:** needs-triage

## Behaviour

- **One result type:** every remote service in `services/` returns `ok` or a failure with a reason (`offline`, `unavailable`, `signed-out`, `plan-limit`) and never throws into the UI. Composables map a failure to one toast; components never see the network.
- **No up-front state:** the app does not poll or show a connectivity indicator. It learns the server is unreachable only when a call fails. A feature stays enabled and its failure shows a toast (decided: no disabled state).
- **Reason wording:** one place holds the message for each reason, in every language. When the reason is `unavailable` (network up, hosting down), the toast adds that the work is safe on this device and offers "Save" through the existing Project export.
- **Pro auto-sync:** a synced Project keeps one "pending changes" flag (latest state wins; no queue of actions). It pushes shortly after edits settle and retries on the next edit, on focus, on the `online` event and with backoff. A click on Sync works once the server is back.
- **Quiet in the background:** only the first failure and the first success after it show a toast. Between them a small banner stays ("Sync pending", and "Synced" when it clears). A user-pressed Share or Sync always answers with its own success or failure toast.
- **Not a security control:** this is courtesy. Limits are enforced by the server (ADR 0044).

## Acceptance

- [ ] A fake remote service returning each failure reason shows the right toast in EN and RU, with no feature-specific code
- [ ] With hosting down, the failure toast says the work is safe on this device and offers "Save"
- [ ] Background sync shows one failure toast, a banner while pending, and one success toast on recovery, however many retries
- [ ] No component or composable imports `fetch`; the existing lint rules still pass
- [ ] The terms Sync pending and Synced are used in the UI copy in EN and RU (glossary: Sync pending)

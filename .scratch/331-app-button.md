# 331: One AppButton for every labelled button, absorbing AppLink

**What to build:** `AppButton`: an optional leading icon (like the + on New Project), the label, an optional `tooltip`, the existing variants, and a new `link` variant that replaces `AppLink`. It can take a registry action (ticket 329). Delete `AppLink` once nothing uses it. Update the design-system Button card.

**Spec:** 343 (unified controls spec)

**Blocked by:** 327, 329

**Status:** needs-triage

- [ ] `AppButton` supports a leading icon, a label, `variant="link"` and an optional Tooltip
- [ ] It takes a registry action or explicit props; disabled uses `aria-disabled` and shows `disabledBody`
- [ ] `AppLink` is removed after the migrations (knip clean)

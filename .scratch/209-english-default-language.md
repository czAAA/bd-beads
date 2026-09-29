# 209: English as the default language

**What to build:** Make English the language the app starts in on a device that has never picked one (it is Russian today, `DEFAULT_LOCALE` in `src/i18n/localeStorage.ts`). There stays one language switcher for the whole app, the Overview included, and one saved choice per device.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Overview / Tour:** not a feature of its own; the Overview (ticket 77) starts in the same language as the app.

- [ ] A device with no saved language opens the app in English, with `lang="en"` on `<html>`
- [ ] A device that already saved a language keeps it, English or Russian
- [ ] Picking a language still saves it on this device, as today

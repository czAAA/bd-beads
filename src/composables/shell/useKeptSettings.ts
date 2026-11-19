import { onScopeDispose, watch } from 'vue'
import { changedSince, KEPT_SETTING_NAMES, settingsStep, type AccountSettings, type DeviceSettings, type KeptSettingName, type KeptSettings, type KeptValue } from '../../domain/keptSettings'
import type { AccountService } from '../../services/account'

/** The device's three settings kept in step, each read as it shows now and set the way the Menu sets it. */
export type DeviceSettingControls = { [N in KeptSettingName]: { value: () => KeptValue<N>; set: (value: KeptValue<N>) => void } }

/** What keeping the settings in step needs from the account flow. */
export interface KeptSettingsDeps {
  account: Pick<AccountService, 'settingChanged' | 'waitingSettings' | 'sendSettings' | 'onOnline'>
  device: DeviceSettingControls
  /** Whether someone is signed in on this device; a Guest's settings stay on the device. */
  signedIn: () => boolean
  /** Sending found the session ended: the device is a Guest's again. */
  onSignedOut: () => void
}

/** Calls `changed` at once for every change of the settings whose value is given here, however it was made: the
 * Menu, or anything else that sets one. */
function onSettingChange(
  values: { [N in KeptSettingName]?: () => KeptValue<N> },
  changed: <N extends KeptSettingName>(name: N, value: KeptValue<N>) => void,
): void {
  const watchOne = <N extends KeptSettingName>(name: N) => {
    const value = values[name] as (() => KeptValue<N>) | undefined
    if (value) watch(value, (next) => changed(name, next), { flush: 'sync' })
  }
  KEPT_SETTING_NAMES.forEach(watchOne)
}

/** The Settings kept in step (ticket 1086, ADR 0014): a signed-in person's language, theme and Lifted pieces are the
 * same on all their devices. A change here is sent at once, or waits quietly until it can be; the account's settings
 * are taken through the Menu's own setters. No toast, no banner. */
export function useKeptSettings(deps: KeptSettingsDeps) {
  /** The account's values on their way to the device: such a change is the account's, not the person's. */
  let arriving: Partial<DeviceSettings> = {}
  let sending = false
  /** How many sends the backend has kept: an answer asked for before the last of them may be older than it. */
  let kept = 0

  const shown = (): DeviceSettings => ({ language: deps.device.language.value(), theme: deps.device.theme.value(), liftedPieces: deps.device.liftedPieces.value() })

  /** Puts the account's `values` on the device. They are all that is on its way now: one expected earlier that never
   * came (a language that couldn't be fetched) is expected no more. */
  function take(values: Partial<DeviceSettings>) {
    arriving = { ...values }
    const takeOne = <N extends KeptSettingName>(name: N) => {
      const value = values[name] as KeptValue<N> | undefined
      if (value !== undefined) deps.device[name].set(value)
    }
    KEPT_SETTING_NAMES.forEach(takeOne)
  }

  /** Sends what waits, and `upload` with it. One send at a time: a change made meanwhile goes with the next. */
  async function send(upload: KeptSettings = {}): Promise<void> {
    if (sending || !deps.signedIn()) return
    const changes: KeptSettings = { ...upload, ...deps.account.waitingSettings() }
    if (Object.keys(changes).length === 0) return
    sending = true
    const answer = await deps.account.sendSettings(changes)
    sending = false
    if (answer.state === 'signed-out') return deps.onSignedOut()
    if (answer.state !== 'kept' || !deps.signedIn()) return
    kept++
    // Where another device's later change won, the device takes it; a setting changed here meanwhile is sent now.
    const waiting = deps.account.waitingSettings()
    take(settingsStep(answer.settings, waiting, shown(), Date.now()).take)
    if (Object.keys(changedSince(waiting, changes)).length > 0) void send()
  }

  onSettingChange({ language: deps.device.language.value, theme: deps.device.theme.value, liftedPieces: deps.device.liftedPieces.value }, (name, value) => {
    const fromAccount = arriving[name] === value
    delete arriving[name]
    if (fromAccount) return
    deps.account.settingChanged(name, value)
    void send()
  })
  // Signed out, or the session ended: nothing is on its way from the account any more.
  watch(deps.signedIn, (signedIn) => signedIn || (arriving = {}), { flush: 'sync' })
  onScopeDispose(deps.account.onOnline(() => void send()))

  return {
    /** Sends what waits, if anything does: for when the tab is back and the account gave no answer of its own. */
    sendWaiting: () => void send(),
    /** Called as the account is asked who is signed in. Gives what takes the answer's settings: the account's win,
     * but for a change waiting here, and a setting the account lacks is sent from the device. An answer that may be
     * older than a change sent meanwhile is left alone. */
    asking(): (settings: AccountSettings | undefined) => void {
      const asked = kept
      return (settings) => {
        if (!settings || asked !== kept) return
        const step = settingsStep(settings, deps.account.waitingSettings(), shown(), Date.now())
        take(step.take)
        void send(step.upload)
      }
    },
  }
}

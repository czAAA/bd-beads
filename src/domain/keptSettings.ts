import { LOCALES } from './locale'

// The Settings kept in step (glossary; ADR 0014, ticket 1086): the three settings a signed-in person finds the same on
// all their devices. The Worker and the app both read them here, so they agree on the names and the values.

/** Each setting kept in step and the values it takes, as the account holds them and the API sends them. `device` is
 * the theme's Match device, which travels as itself: each device still follows its own light or dark. */
const KEPT_SETTING_VALUES = {
  language: LOCALES,
  theme: ['device', 'light', 'dark', 'contrast'],
  liftedPieces: ['on', 'off'],
} as const

/** A setting kept in step, by its name. */
export type KeptSettingName = keyof typeof KEPT_SETTING_VALUES
/** A value the setting takes. */
export type KeptValue<N extends KeptSettingName> = (typeof KEPT_SETTING_VALUES)[N][number]

/** The settings kept in step, in the order they are listed. */
export const KEPT_SETTING_NAMES = Object.keys(KEPT_SETTING_VALUES) as KeptSettingName[]

/** One setting as the account holds it: its value and when it was changed, in epoch milliseconds. */
interface KeptSetting<N extends KeptSettingName> {
  value: KeptValue<N>
  changedAt: number
}

/** Settings with their change times: what a device sends, any of the three. */
export type KeptSettings = { [N in KeptSettingName]?: KeptSetting<N> }

/** What a device reads of its account's settings. A setting whose value this build doesn't know (a newer build's on
 * another device) is `unknown`: held, but not for this device to apply or replace. */
export type AccountSettings = { [N in KeptSettingName]?: KeptSetting<N> | 'unknown' }

/** What the device shows now, setting by setting. */
export type DeviceSettings = { [N in KeptSettingName]: KeptValue<N> }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** One setting from sent data, or undefined when its value is not one the setting takes or its time is not a time. */
function settingOf<N extends KeptSettingName>(name: N, sent: unknown): KeptSetting<N> | undefined {
  if (!isRecord(sent)) return undefined
  const { value, changedAt } = sent
  const known = (KEPT_SETTING_VALUES[name] as readonly KeptValue<N>[]).find((one) => one === value)
  if (known === undefined || typeof changedAt !== 'number' || !Number.isSafeInteger(changedAt) || changedAt < 0) return undefined
  return { value: known, changedAt }
}

/** Fills `into` with the settings `sent` names; false when one of them is not shaped as a setting. */
function readInto<N extends KeptSettingName>(into: KeptSettings, name: N, sent: unknown): boolean {
  const setting = settingOf(name, sent)
  if (setting) (into as { [K in N]?: KeptSetting<K> })[name] = setting
  return setting !== undefined
}

/** The changes a device sends, `{ settings: { <name>: { value, changedAt } } }`, as the Worker takes them: undefined
 * when the body is shaped otherwise, or names a setting or a value that is not one of the three's own. */
export function parseSettingsChanges(body: unknown): KeptSettings | undefined {
  if (!isRecord(body) || !isRecord(body.settings)) return undefined
  const changes: KeptSettings = {}
  for (const [name, sent] of Object.entries(body.settings)) {
    const known = KEPT_SETTING_NAMES.find((one) => one === name)
    if (!known || !readInto(changes, known, sent)) return undefined
  }
  return changes
}

/** The account's settings as the backend answers them, as a device reads them; undefined when the answer holds none
 * (the `settings` switch is off). A setting this build doesn't know is left out, a value it doesn't know is `unknown`. */
export function parseAccountSettings(sent: unknown): AccountSettings | undefined {
  if (!isRecord(sent)) return undefined
  const settings: AccountSettings = {}
  for (const name of KEPT_SETTING_NAMES) {
    if (Object.hasOwn(sent, name) && !readInto(settings as KeptSettings, name, sent[name])) settings[name] = 'unknown'
  }
  return settings
}

/** The settings of `waiting` that `sent` didn't carry as they are now: changed again, at another time, since it left. */
export function changedSince(waiting: KeptSettings, sent: KeptSettings): KeptSettings {
  const left: KeptSettings = { ...waiting }
  for (const name of KEPT_SETTING_NAMES) {
    if (left[name]?.changedAt === sent[name]?.changedAt && left[name]?.value === sent[name]?.value) delete left[name]
  }
  return left
}

/** What a device does with its account's settings (ticket 1086). */
export interface SettingsStep {
  /** The account's values the device takes: every one that differs from the device's and is not waiting to be sent
   * from here. */
  take: Partial<DeviceSettings>
  /** The device's own values, as of now, for the settings the account doesn't hold yet. */
  upload: KeptSettings
}

/** The account wins, except over a change made here and not yet sent (`waiting`), which the backend decides by its
 * time; a setting the account lacks is taken from the device, so a first sign-in uploads the device's three. */
export function settingsStep(account: AccountSettings, waiting: KeptSettings, device: DeviceSettings, now: number): SettingsStep {
  const step: SettingsStep = { take: {}, upload: {} }
  const settle = <N extends KeptSettingName>(name: N) => {
    const held = account[name] as KeptSetting<N> | 'unknown' | undefined
    if (waiting[name] || held === 'unknown') return
    if (held === undefined) (step.upload as { [K in N]?: KeptSetting<K> })[name] = { value: device[name], changedAt: now }
    else if (held.value !== device[name]) (step.take as { [K in N]?: KeptValue<K> })[name] = held.value
  }
  KEPT_SETTING_NAMES.forEach(settle)
  return step
}

import type { SettingSpec } from '../domain/settingSpec'
import type { SettingWords, Translations } from './translations'

/** A Technique setting's words in the current language, by its label key (ticket 0624); a key no language has (a test
 * fails on it) reads as itself. */
export function weaveSettingWords(t: Translations, setting: Pick<SettingSpec, 'labelKey'>): SettingWords {
  const key = setting.labelKey
  return t.weaveSettings[key] ?? { label: key, less: key, more: key, value: key, locked: key, changed: key }
}

import type { SettingSpec } from '../../domain/settingSpec'

/** A Technique setting stepper's test id under `prefix`, from its id in kebab case (`brickBlock` is `x-brick-block`), so
 * every place that draws the settings names a stepper the same way (ticket 0626). */
export function settingTestid(prefix: string, setting: Pick<SettingSpec, 'id'>): string {
  return `${prefix}-${setting.id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

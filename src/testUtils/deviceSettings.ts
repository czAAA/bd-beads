import { reactive } from 'vue'
import type { DeviceSettings, KeptSettingName, KeptValue } from '../domain/keptSettings'
import type { DeviceSettingControls } from '../composables/shell/useKeptSettings'

/** A device's three Settings kept in step, in memory (ticket 1086): `shown` is what the device shows and a test
 * changes as the Menu would, `controls` is what the account flow reads and sets them through, and `sets` lists every
 * value set through them, oldest first. */
export function memoryDeviceSettings(start: Partial<DeviceSettings> = {}): { shown: DeviceSettings; sets: Partial<DeviceSettings>[]; controls: DeviceSettingControls } {
  const shown = reactive<DeviceSettings>({ language: 'en', theme: 'device', liftedPieces: 'on', ...start })
  const sets: Partial<DeviceSettings>[] = []
  const control = <N extends KeptSettingName>(name: N) => ({
    value: () => shown[name] as KeptValue<N>,
    set: (value: KeptValue<N>) => {
      sets.push({ [name]: value })
      ;(shown as { [K in N]: KeptValue<K> })[name] = value
    },
  })
  return { shown, sets, controls: { language: control('language'), theme: control('theme'), liftedPieces: control('liftedPieces') } }
}

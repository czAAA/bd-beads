import { computed, type ComputedRef } from 'vue'
import { privacyControlSent, switchOpenCount } from '../../services/appOpened'
import { useDevicePreferences } from '../../services/devicePreferences'

/** About's switch for the day's count of app opens (ticket 1209): this device's alone, on until switched off. With
 * Global Privacy Control it shows off and can't be turned on, and its explanation says the browser asked. */
export function useOpenCount(): { on: ComputedRef<boolean>; blocked: boolean; setOn: (on: boolean) => void } {
  const preferences = useDevicePreferences()
  const choice = preferences.get('countOpens')
  const blocked = privacyControlSent()
  return {
    on: computed(() => !blocked && choice.value),
    blocked,
    setOn: (on) => {
      if (!blocked) switchOpenCount(preferences, on)
    },
  }
}

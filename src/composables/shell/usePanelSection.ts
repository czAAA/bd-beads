import { computed, type ComputedRef } from 'vue'
import { useDevicePreferences } from '../../services/devicePreferences'

/** Whether a panel section is open, and a way to flip it (ticket 0553): kept on this device by `panel:section` id, every
 * section open until it is closed, or, for one that starts `folded` (ticket 0971), folded until it is opened. */
export function usePanelSection(id: () => string, folded: () => boolean = () => false): { open: ComputedRef<boolean>; toggle: () => void } {
  const preferences = useDevicePreferences()
  const closed = preferences.get('panelSectionsClosed')
  const opened = preferences.get('panelSectionsOpened')
  /** The ids of the sections the other way from how they start. */
  const unlikeStart = () => (folded() ? opened : closed)
  const open = computed(() => unlikeStart().value.includes(id()) === folded())
  function toggle() {
    const list = unlikeStart()
    list.value = list.value.includes(id()) ? list.value.filter((each) => each !== id()) : [...list.value, id()]
  }
  return { open, toggle }
}

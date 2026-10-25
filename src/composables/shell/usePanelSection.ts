import { computed, type ComputedRef } from 'vue'
import { useDevicePreferences } from '../../services/devicePreferences'

/** Whether a panel section is open, and a way to flip it (ticket 0553): kept on this device by `panel:section` id, every
 * section open until it is closed. */
export function usePanelSection(id: () => string): { open: ComputedRef<boolean>; toggle: () => void } {
  const closed = useDevicePreferences().get('panelSectionsClosed')
  const open = computed(() => !closed.value.includes(id()))
  function toggle() {
    closed.value = open.value ? [...closed.value, id()] : closed.value.filter((closedId) => closedId !== id())
  }
  return { open, toggle }
}

import { computed, type ComputedRef, type Ref } from 'vue'
import type { PrintChoices } from '../../rendering/printText'
import { useDevicePreferences } from '../../services/devicePreferences'

/** The Export panel's print choices on this device (ticket 0916): Large beads and Row by row, each a remembered switch, and
 * both together as the exports and the File size estimate read them. */
export function usePrintChoices(): { largeBeads: Ref<boolean>; rowByRow: Ref<boolean>; choices: ComputedRef<PrintChoices> } {
  const preferences = useDevicePreferences()
  const largeBeads = preferences.get('printLargeBeads')
  const rowByRow = preferences.get('printRowByRow')
  return { largeBeads, rowByRow, choices: computed(() => ({ largeBeads: largeBeads.value, rowByRow: rowByRow.value })) }
}

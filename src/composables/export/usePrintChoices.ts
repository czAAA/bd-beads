import { computed, type ComputedRef, type Ref } from 'vue'
import type { PrintChoices } from '../../rendering/printText'
import { useDevicePreferences } from '../../services/devicePreferences'

/** The Export panel's print choices on this device (tickets 0916, 1096): Cover page, Large beads and Row by row, each a
 * remembered switch, and all together as the exports and the File size estimate read them. */
export function usePrintChoices(): { cover: Ref<boolean>; largeBeads: Ref<boolean>; rowByRow: Ref<boolean>; choices: ComputedRef<PrintChoices> } {
  const preferences = useDevicePreferences()
  const cover = preferences.get('printCover')
  const largeBeads = preferences.get('printLargeBeads')
  const rowByRow = preferences.get('printRowByRow')
  return { cover, largeBeads, rowByRow, choices: computed(() => ({ cover: cover.value, largeBeads: largeBeads.value, rowByRow: rowByRow.value })) }
}

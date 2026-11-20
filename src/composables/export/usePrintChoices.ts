import { computed, type ComputedRef, type Ref } from 'vue'
import type { PrintChoices } from '../../rendering/printText'
import { useDevicePreferences } from '../../services/devicePreferences'

/** The Export panel's print choices on this device (tickets 0916, 1096): Cover page, Black and white, Large beads and Row by
 * row, each a remembered switch, and all together as the exports and the File size estimate read them. */
export function usePrintChoices(): { cover: Ref<boolean>; blackAndWhite: Ref<boolean>; largeBeads: Ref<boolean>; rowByRow: Ref<boolean>; choices: ComputedRef<PrintChoices> } {
  const preferences = useDevicePreferences()
  const cover = preferences.get('printCover')
  const blackAndWhite = preferences.get('printBlackAndWhite')
  const largeBeads = preferences.get('printLargeBeads')
  const rowByRow = preferences.get('printRowByRow')
  const choices = computed(() => ({ cover: cover.value, blackAndWhite: blackAndWhite.value, largeBeads: largeBeads.value, rowByRow: rowByRow.value }))
  return { cover, blackAndWhite, largeBeads, rowByRow, choices }
}

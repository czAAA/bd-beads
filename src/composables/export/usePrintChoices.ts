import { computed, type ComputedRef, type Ref } from 'vue'
import type { RowByRowWay } from '../../domain/rowByRowWay'
import type { PrintChoices } from '../../rendering/printText'
import { useDevicePreferences } from '../../services/devicePreferences'

/** The Export panel's print choices on this device (tickets 0916, 1096, 1127): Cover page, Black and white, Empty grid,
 * Chart border, Large beads and Row by row, each a remembered switch (Row by row with the way its rows run), and all together as the exports and the File size
 * estimate read them. */
export function usePrintChoices(): { cover: Ref<boolean>; blackAndWhite: Ref<boolean>; emptyGrid: Ref<boolean>; chartBorder: Ref<boolean>; largeBeads: Ref<boolean>; rowByRow: Ref<boolean>; rowByRowWay: Ref<RowByRowWay>; choices: ComputedRef<PrintChoices> } {
  const preferences = useDevicePreferences()
  const cover = preferences.get('printCover')
  const blackAndWhite = preferences.get('printBlackAndWhite')
  const emptyGrid = preferences.get('printEmptyGrid')
  const chartBorder = preferences.get('printChartBorder')
  const largeBeads = preferences.get('printLargeBeads')
  const rowByRow = preferences.get('printRowByRow')
  const rowByRowWay = preferences.get('printRowByRowWay')
  const choices = computed(() => ({ cover: cover.value, blackAndWhite: blackAndWhite.value, emptyGrid: emptyGrid.value, chartBorder: chartBorder.value, largeBeads: largeBeads.value, rowByRow: rowByRow.value, ...(rowByRowWay.value === 'progress' ? {} : { rowByRowWay: rowByRowWay.value }) }))
  return { cover, blackAndWhite, emptyGrid, chartBorder, largeBeads, rowByRow, rowByRowWay, choices }
}

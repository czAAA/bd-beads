import type { Ref } from 'vue'
import type { ExportQuality } from '../../domain/exportQuality'
import { useDevicePreferences } from '../../services/devicePreferences'

/** The Export quality chosen on this device (ticket 576): one ref, remembered; the slider sets it and the exports follow it (tickets 571, 572). */
export function useExportQuality(): Ref<ExportQuality> {
  return useDevicePreferences().get('exportQuality')
}

import { computed } from 'vue'
import { useDevicePreferences } from '../../services/devicePreferences'
import { useI18n } from '../../i18n/useI18n'

/** The unit the Schema size is stated in, beads or mm (ticket 342): kept on this device, shared by the Frame section
 * and Convert image, never saved with a Project. */
export function useSizeUnit() {
  const { t } = useI18n()
  const unit = useDevicePreferences().get('sizeUnit')
  const unitOptions = computed(() => [
    { value: 'beads' as const, label: t.value.form.unitBeads },
    { value: 'mm' as const, label: t.value.form.unitMm },
  ])
  return { unit, unitOptions }
}

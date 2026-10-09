import { computed } from 'vue'
import { useDevicePreferences } from '../../services/devicePreferences'
import { useI18n } from '../../i18n/useI18n'

/**
 * The unit the Pattern size is stated in, beads or mm (ticket 342): kept on this device and shared by the Frame section
 * and Convert image's size step, so choosing it in one is choosing it in the other. Never saved with a Project. Also
 * the switch's two options, in the interface language.
 */
export function useSizeUnit() {
  const { t } = useI18n()
  const unit = useDevicePreferences().get('sizeUnit')
  const unitOptions = computed(() => [
    { value: 'beads' as const, label: t.value.form.unitBeads },
    { value: 'mm' as const, label: t.value.form.unitMm },
  ])
  return { unit, unitOptions }
}

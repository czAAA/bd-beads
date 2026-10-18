import { computed } from 'vue'
import { describeWeave, type Technique } from '../../domain/weave'
import { useDevicePreferences } from '../../services/devicePreferences'
import { useI18n } from '../../i18n/useI18n'

/** The unit the Schema size is stated in, beads or mm (ticket 342): kept on this device, shared by the Frame section
 * and Convert image, never saved with a Project. */
export function useSizeUnit(technique: () => Technique = () => 'loom') {
  const { t } = useI18n()
  const unit = useDevicePreferences().get('sizeUnit')
  // Where the Technique counts Units (ticket 482) the same choice reads Units.
  const countsUnits = computed(() => describeWeave({ technique: technique() }).countsUnits)
  const unitOptions = computed(() => [
    { value: 'beads' as const, label: countsUnits.value ? t.value.form.unitUnits : t.value.form.unitBeads },
    { value: 'mm' as const, label: t.value.form.unitMm },
  ])
  const countTemplate = computed(() => (countsUnits.value ? t.value.form.estimateUnits : t.value.form.estimateBeads))
  return { unit, unitOptions, countTemplate }
}

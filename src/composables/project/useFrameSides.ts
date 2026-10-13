import { computed } from 'vue'
import { useDevicePreferences } from '../../services/devicePreferences'
import { useI18n } from '../../i18n/useI18n'

/**
 * Which side the Frame's Width and Height steppers grow and shrink it from (ticket 410): Left or Right for Width, Top or
 * Bottom for Height. Kept on this device like the beads | mm unit (ticket 342) and never saved with a Project. Also each
 * choice's options, in the interface language, with the Tooltip that says what the option does.
 */
export function useFrameSides() {
  const { t } = useI18n()
  const preferences = useDevicePreferences()
  const widthSide = preferences.get('frameWidthSide')
  const heightSide = preferences.get('frameHeightSide')
  const widthSideOptions = computed(() => [
    { value: 'left' as const, label: t.value.frame.sideLeft, body: t.value.frame.sideLeftBody },
    { value: 'right' as const, label: t.value.frame.sideRight, body: t.value.frame.sideRightBody },
  ])
  const heightSideOptions = computed(() => [
    { value: 'top' as const, label: t.value.frame.sideTop, body: t.value.frame.sideTopBody },
    { value: 'bottom' as const, label: t.value.frame.sideBottom, body: t.value.frame.sideBottomBody },
  ])
  return { widthSide, heightSide, widthSideOptions, heightSideOptions }
}

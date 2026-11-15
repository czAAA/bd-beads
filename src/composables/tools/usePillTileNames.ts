import type { Ref } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import type { PillTile } from '../../domain/toolPill'
import type { Translations } from '../../i18n/translations'
import type { DevicePreferences } from '../../services/devicePreferences'
import { pillTileAction } from '../shell/controlRegistry'
import type { MessageTone } from '../ui/useToasts'

/** What a first tap's name needs: whether the pointer is a finger, the toasts, and where the named tiles are kept. */
export interface PillTileNamesDeps {
  /** A coarse pointer: a finger has no hover to show a Tooltip. */
  touch: Readonly<Ref<boolean>>
  showToast: (id: string, text: string, tone?: MessageTone) => void
  messages: () => Translations
  preferences: DevicePreferences
}

/** On touch the first tap on each Tool pill tile says its Tooltip's name and line in a toast, as the Mirror tile's
 * armed toast does (ticket 0927): once per tile on this device, and never with a mouse. The tap still does its job. */
export function usePillTileNames(deps: PillTileNamesDeps) {
  const named = deps.preferences.get('pillTilesNamed')

  function onPillTileTap(tile: PillTile) {
    if (!deps.touch.value || named.value.includes(tile)) return
    named.value = [...named.value, tile]
    const t = deps.messages()
    const action = pillTileAction(tile)
    const line = (action.touchBody ?? action.body)?.(t) ?? ''
    deps.showToast('pill-tile-name', fillBlanks(t.toolPill.tileNamed, { name: action.name(t), line }), 'info')
  }

  return { onPillTileTap }
}

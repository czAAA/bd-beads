import { computed, ref, type Ref } from 'vue'
import { isAddedColorId, type Palette } from '../../domain/palette'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'

/** What removing added colors needs from the app shell: the Palette and how its added swatches leave it (Edits, ADR
 * 0036), the chosen color and how another is chosen, and the toast that offers Undo. */
export interface RemoveColorFlowDeps {
  palette: Readonly<Ref<Palette>>
  /** Each hands back how to put what it removed back, or undefined when nothing was removed. */
  removeAdded: (colorId: string) => (() => void) | undefined
  removeAllAdded: () => (() => void) | undefined
  selectedColorId: Readonly<Ref<string | undefined>>
  onSelectColor: (colorId: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  messages: () => Translations
  locale: () => Locale
}

/** Removing an added swatch (tickets 228, 304) or every one at once (ticket 0532), each after a confirmation. Painted
 * cells keep their hex. Removing the active color steps back to the default one; the toast's Undo puts the colors
 * back and selects the active one again, unless another was chosen since. */
export function useRemoveColorFlow(deps: RemoveColorFlowDeps) {
  /** Takes the colors out with `remove` and offers their Undo in a toast; `removesChosen` says whether the chosen
   * color is among them. */
  function removeWithUndo(removesChosen: (colorId: string) => boolean, remove: () => (() => void) | undefined, toastId: string, text: string) {
    const previous = deps.selectedColorId.value
    const wasSelected = !!previous && removesChosen(previous)
    const restore = remove()
    if (!restore) return
    const fallback = deps.palette.value.defaultColorId
    if (wasSelected && fallback) deps.onSelectColor(fallback)
    deps.showToast(toastId, text, 'info', {
      label: deps.messages().palette.undoButton,
      run: () => {
        restore()
        if (wasSelected && deps.selectedColorId.value === fallback) deps.onSelectColor(previous)
      },
    })
  }

  /** The added swatch whose removal awaits confirmation (ticket 304); undefined when no such dialog is open. */
  const pendingColorRemovalId = ref<string>()
  const pendingColorRemovalHex = computed(() => deps.palette.value.byId(pendingColorRemovalId.value)?.hex)
  function onRequestRemoveAddedColor(colorId: string) {
    pendingColorRemovalId.value = colorId
  }
  function onCancelRemoveAddedColor() {
    pendingColorRemovalId.value = undefined
  }
  function onConfirmRemoveAddedColor() {
    const colorId = pendingColorRemovalId.value
    pendingColorRemovalId.value = undefined
    if (!colorId) return
    // One toast per swatch, so removing a second doesn't take the first one's Undo away.
    removeWithUndo((chosen) => chosen === colorId, () => deps.removeAdded(colorId), `palette-removed-${colorId}`, deps.messages().palette.removed)
  }

  /** The bin in Edit palette asks first, and the dialog names how many leave. */
  const removeAllColorsConfirmOpen = ref(false)
  const addedColorCount = computed(() => deps.palette.value.colors.filter((color) => isAddedColorId(color.id)).length)
  const removeAllColorsMessage = computed(() => plural(deps.locale(), addedColorCount.value, deps.messages().palette.removeAllConfirmMessage))
  function onRequestRemoveAllAddedColors() {
    removeAllColorsConfirmOpen.value = true
  }
  function onCancelRemoveAllAddedColors() {
    removeAllColorsConfirmOpen.value = false
  }
  function onConfirmRemoveAllAddedColors() {
    removeAllColorsConfirmOpen.value = false
    removeWithUndo(isAddedColorId, deps.removeAllAdded, 'palette-removed-all', deps.messages().palette.removedAll)
  }

  return {
    pendingColorRemovalId,
    pendingColorRemovalHex,
    onRequestRemoveAddedColor,
    onCancelRemoveAddedColor,
    onConfirmRemoveAddedColor,
    removeAllColorsConfirmOpen,
    removeAllColorsMessage,
    onRequestRemoveAllAddedColors,
    onCancelRemoveAllAddedColors,
    onConfirmRemoveAllAddedColors,
  }
}

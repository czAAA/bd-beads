import { computed, type Ref } from 'vue'
import { isAddedColorId, type Palette } from '../../domain/palette'
import { fillBlanks } from '../../domain/fillBlanks'
import { plural, type PluralForms } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What removing added colors needs from the app shell: the Palette and how its added swatches leave it (Edits, ADR
 * 0036), the chosen color and how another is chosen, and the toast that offers Undo. */
export interface RemoveColorFlowDeps {
  palette: Readonly<Ref<Palette>>
  /** Each hands back how to put what it removed back, or undefined when nothing was removed. */
  removeAdded: (colorId: string) => (() => void) | undefined
  removeAllAdded: () => (() => void) | undefined
  /** How many beads the layers show in the swatches `colorIds` stand for: what their removal takes (ticket 1124). */
  paintedBeads: (colorIds: readonly string[]) => number
  selectedColorId: Readonly<Ref<string | undefined>>
  onSelectColor: (colorId: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  messages: () => Translations
  locale: () => Locale
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** Removing an added swatch (tickets 228, 304) or every one at once (ticket 0532), each after a confirmation that names
 * the beads painted in them, which leave with them (ticket 1124). Removing the active color steps back to the default one; the toast's Undo puts the colors
 * back and selects the active one again, unless another was chosen since. */
export function useRemoveColorFlow(deps: RemoveColorFlowDeps) {
  const dialogs = deps.dialogs ?? useDialogs()
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
  const pendingColorRemovalId = dialogs.question<string>('remove-color')
  const pendingColorRemovalHex = computed(() => deps.palette.value.byId(pendingColorRemovalId.value)?.hex)
  /** What the question says: the color leaves, and the beads painted in it with it (ticket 1124). */
  const removeColorMessage = computed(() => {
    const [colorId, hex] = [pendingColorRemovalId.value, pendingColorRemovalHex.value]
    if (!colorId || !hex) return ''
    const t = deps.messages().palette
    return withBeads(fillBlanks(t.removeConfirmMessage, { hex }), [colorId], t.removeConfirmBeads)
  })
  /** The question's text with the sentence naming how many beads go after it, when any is painted in `colorIds`. */
  function withBeads(text: string, colorIds: readonly string[], beads: PluralForms): string {
    const count = deps.paintedBeads(colorIds)
    return count > 0 ? `${text} ${plural(deps.locale(), count, beads)}` : text
  }
  function onRequestRemoveAddedColor(colorId: string) {
    pendingColorRemovalId.value = colorId
  }
  function onCancelRemoveAddedColor() {
    pendingColorRemovalId.value = undefined
  }
  function onConfirmRemoveAddedColor() {
    const colorId = pendingColorRemovalId.value
    pendingColorRemovalId.value = undefined
    if (colorId) onRemoveAddedColor(colorId)
  }
  /** The removal itself, with no question (ticket 1092): what the confirmation runs, and what a press on a Bead colors
   * row that is in the Palette runs at once, as a second press there puts the code back. */
  function onRemoveAddedColor(colorId: string) {
    // One toast per swatch, so removing a second doesn't take the first one's Undo away.
    removeWithUndo((chosen) => chosen === colorId, () => deps.removeAdded(colorId), `palette-removed-${colorId}`, deps.messages().palette.removed)
  }
  /** A press that removes a color at once (a Bead colors row's, ticket 1092) asks first when beads are painted in it,
   * as they would leave with it (ticket 1124). */
  function onRemoveAddedColorOrAsk(colorId: string) {
    if (deps.paintedBeads([colorId]) > 0) onRequestRemoveAddedColor(colorId)
    else onRemoveAddedColor(colorId)
  }

  /** The bin in Edit palette asks first, and the dialog names how many leave. */
  const removeAllColorsConfirmOpen = dialogs.flag('remove-all-colors')
  const addedColorIds = computed(() => deps.palette.value.colors.filter((color) => isAddedColorId(color.id)).map((color) => color.id))
  const removeAllColorsMessage = computed(() => {
    const t = deps.messages().palette
    return withBeads(plural(deps.locale(), addedColorIds.value.length, t.removeAllConfirmMessage), addedColorIds.value, t.removeAllConfirmBeads)
  })
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
    removeColorMessage,
    onRequestRemoveAddedColor,
    onCancelRemoveAddedColor,
    onConfirmRemoveAddedColor,
    onRemoveAddedColor,
    onRemoveAddedColorOrAsk,
    removeAllColorsConfirmOpen,
    removeAllColorsMessage,
    onRequestRemoveAllAddedColors,
    onCancelRemoveAllAddedColors,
    onConfirmRemoveAllAddedColors,
  }
}

import { computed, inject, provide, ref, type ComputedRef, type InjectionKey } from 'vue'
import { PALETTE, addUsedColor, isAddedColorId, paletteWith, removeAddedColor, restoreAddedColor, type AddUsedColorOutcome, type PaletteColor } from '../../domain/palette'
import type { AddedColorsStore } from '../../services/addedColorsStore'

const paletteKey: InjectionKey<ComputedRef<readonly PaletteColor[]>> = Symbol('palette')

/**
 * The Palette as it stands (CONTEXT.md, ticket 227, ADR 0025): the built-in colors plus the Custom colors that joined
 * by painting a cell, kept on the device. Call once from the app shell; `palette` is what every swatch reads.
 */
export function useAddedColors(store: AddedColorsStore) {
  const added = ref<readonly string[]>(store.load())
  const palette = computed(() => paletteWith(added.value))

  provide(paletteKey, palette)

  /** A Custom color has painted a cell: it joins the Palette on first use. Hands back what happened and the swatch it is. */
  function addUsed(hex: string): { outcome: AddUsedColorOutcome; colorId?: string } {
    const result = addUsedColor(added.value, hex)
    if (result.outcome === 'added') {
      added.value = result.added
      store.save(result.added)
    }
    return { outcome: result.outcome, colorId: palette.value.find((color) => color.hex === hex.toLowerCase())?.id }
  }

  /** An added swatch is taken out of the Palette (ticket 228). Hands back how to put it back (false when it can't: the Palette has filled up since), or undefined for a color that isn't an added one. */
  function removeAdded(colorId: string): (() => boolean) | undefined {
    const hex = palette.value.find((color) => color.id === colorId && isAddedColorId(color.id))?.hex
    const removal = hex ? removeAddedColor(added.value, hex) : undefined
    if (!hex || !removal) return undefined
    added.value = removal.added
    store.save(removal.added)
    return () => {
      const restored = restoreAddedColor(added.value, hex, removal.index)
      if (!restored.includes(hex)) return false
      added.value = restored
      store.save(restored)
      return true
    }
  }

  return { palette, addedCount: computed(() => added.value.length), addUsed, removeAdded }
}

const removeKey: InjectionKey<(colorId: string) => void> = Symbol('removeAddedColor')

/** The app shell hands out how an added swatch is removed (ticket 228), so the three places that show the Palette needn't pass it down. */
export function provideRemoveAddedColor(remove: (colorId: string) => void) {
  provide(removeKey, remove)
}

/** How a swatch asks to be removed; absent (mounted alone) means no swatch offers removal. */
export function useRemoveAddedColor(): ((colorId: string) => void) | undefined {
  return inject(removeKey, undefined)
}

/** The Palette for a swatch component: the built-in colors alone when no app shell provides one. */
export function usePalette(): ComputedRef<readonly PaletteColor[]> {
  return inject(paletteKey, () => computed(() => PALETTE), true)
}

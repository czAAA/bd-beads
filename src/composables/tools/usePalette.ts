import { computed, inject, provide, ref, type ComputedRef, type InjectionKey } from 'vue'
import { PALETTE, addUsedColor, paletteWith, type AddUsedColorOutcome, type PaletteColor } from '../../domain/palette'
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

  return { palette, addUsed }
}

/** The Palette for a swatch component: the built-in colors alone when no app shell provides one. */
export function usePalette(): ComputedRef<readonly PaletteColor[]> {
  return inject(paletteKey, () => computed(() => PALETTE), true)
}

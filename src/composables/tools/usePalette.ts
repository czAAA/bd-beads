import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { PALETTE, addUsedColor, addedColorId, isAddedColorId, moveSlot, orderedPalette, removeAddedColor, restoreAddedColor, type AddUsedColorOutcome, type PaletteColor } from '../../domain/palette'
import type { AddedColorsStore } from '../../services/addedColorsStore'

const paletteKey: InjectionKey<ComputedRef<readonly PaletteColor[]>> = Symbol('palette')

/**
 * The Palette as it stands (CONTEXT.md, ticket 227, ADR 0002): the built-in colors plus the Custom colors that joined
 * by painting a cell, kept on the device. Call once from the app shell; `palette` is what every swatch reads.
 */
export function useAddedColors(store: AddedColorsStore) {
  const added = ref<readonly string[]>(store.load())
  /** The slots' order as arranged (ticket 398); the colors it doesn't name yet follow in the default order. */
  const order = ref<readonly string[]>(store.loadOrder())
  const palette = computed(() => orderedPalette(added.value, order.value))

  /** Slots are what the order keeps: an added color joins the last one, a removed one's slot closes up. */
  function setOrder(ids: readonly string[]) {
    order.value = ids
    store.saveOrder(ids)
  }

  provide(paletteKey, palette)

  /** A Custom color has painted a cell: it joins the Palette on first use. Hands back what happened and the swatch it is. */
  function addUsed(hex: string): { outcome: AddUsedColorOutcome; colorId?: string } {
    const result = addUsedColor(added.value, hex)
    if (result.outcome === 'added') {
      const ids = palette.value.map((color) => color.id)
      added.value = result.added
      store.save(result.added)
      setOrder([...ids, addedColorId(result.added.at(-1)!)])
    }
    return { outcome: result.outcome, colorId: palette.value.find((color) => color.hex === hex.toLowerCase())?.id }
  }

  /** An added swatch is taken out of the Palette (ticket 228). Hands back how to put it back (false when it can't: the Palette has filled up since), or undefined for a color that isn't an added one. */
  function removeAdded(colorId: string): (() => boolean) | undefined {
    const hex = palette.value.find((color) => color.id === colorId && isAddedColorId(color.id))?.hex
    const removal = hex ? removeAddedColor(added.value, hex) : undefined
    if (!hex || !removal) return undefined
    const ids = palette.value.map((color) => color.id)
    const slot = ids.indexOf(colorId)
    added.value = removal.added
    store.save(removal.added)
    setOrder(ids.filter((id) => id !== colorId))
    return () => {
      const restored = restoreAddedColor(added.value, hex, removal.index)
      if (!restored.includes(hex)) return false
      const current = palette.value.map((color) => color.id)
      added.value = restored
      store.save(restored)
      setOrder([...current.slice(0, slot), colorId, ...current.slice(slot)])
      return true
    }
  }

  /** A swatch dragged (or nudged) from one slot to another (ticket 398); its Shift+key follows the slot it lands in. */
  function moveColor(from: number, to: number) {
    setOrder(moveSlot(palette.value.map((color) => color.id), from, to))
  }

  return { palette, addedCount: computed(() => added.value.length), addUsed, removeAdded, moveColor }
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

const moveKey: InjectionKey<(from: number, to: number) => void> = Symbol('moveColor')

/** The app shell hands out how a swatch moves to another slot (ticket 398). */
export function provideMoveColor(move: (from: number, to: number) => void) {
  provide(moveKey, move)
}

/** How a swatch asks to move; absent (mounted alone) means the Palette can't be rearranged. */
export function useMoveColor(): ((from: number, to: number) => void) | undefined {
  return inject(moveKey, undefined)
}

/** Pick color from canvas (ticket 398): whether the next press on the canvas takes a bead's color, and how the button arms or disarms it. */
export interface ColorPick {
  picking: Readonly<Ref<boolean>>
  toggle: () => void
}

const colorPickKey: InjectionKey<ColorPick> = Symbol('colorPick')

export function provideColorPick(pick: ColorPick) {
  provide(colorPickKey, pick)
}

/** Absent (mounted alone) means there is no canvas to pick from, so no button is offered. */
export function useColorPick(): ColorPick | undefined {
  return inject(colorPickKey, undefined)
}

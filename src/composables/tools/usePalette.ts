import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { PALETTE, addUsedColor, defaultPaletteIds, moveSlot, paletteColors, removeAddedColor, restoreAddedColor, type AddUsedColorOutcome, type PaletteColor, type PaletteIds } from '../../domain/palette'
import type { Project } from '../../domain/project'
import type { EditFn } from '../project/useEdit'

const paletteKey: InjectionKey<ComputedRef<readonly PaletteColor[]>> = Symbol('palette')

/** What the Palette needs from the app shell: the open Project and Edit, the one way an undoable change reaches it
 * (ADR 0036). */
export interface ProjectPaletteDeps {
  currentProject: () => Project | undefined
  edit: EditFn
}

/** The Palette (CONTEXT.md, ticket 0525, ADR 0002): the open Project's twelve built-in colors and the Custom colors
 * that joined it, in slot order. Every change is an Edit, so Undo covers it. Call once from the shell. */
export function useProjectPalette({ currentProject, edit }: ProjectPaletteDeps) {
  const palette = computed(() => paletteColors(currentProject()?.palette ?? defaultPaletteIds()))
  provide(paletteKey, palette)

  function setPalette(ids: PaletteIds) {
    edit('exempt', (project) => ({ ...project, palette: ids, updatedAt: Date.now() }))
  }

  /** A Custom color has been chosen or painted: it joins the Palette on first use, in the last slot. Hands back whether
   * it joined and the swatch it is. */
  function addUsed(hex: string): { outcome: AddUsedColorOutcome; colorId?: string } {
    const project = currentProject()
    if (!project) return { outcome: 'known' }
    const { ids, outcome, colorId } = addUsedColor(project.palette, hex)
    if (outcome === 'added') setPalette(ids)
    return { outcome, colorId }
  }

  /** An added swatch is taken out of the Palette (ticket 228). Hands back how to put it back, or undefined for a color
   * that isn't an added one. */
  function removeAdded(colorId: string): (() => void) | undefined {
    const project = currentProject()
    const removal = project && removeAddedColor(project.palette, colorId)
    if (!removal) return undefined
    setPalette(removal.ids)
    return () => {
      const now = currentProject()
      if (now) setPalette(restoreAddedColor(now.palette, colorId, removal.slot))
    }
  }

  /** A swatch dragged (or nudged) from one slot to another (ticket 398); its Shift+key follows the slot it lands in. */
  function moveColor(from: number, to: number) {
    setPalette(moveSlot(palette.value.map((color) => color.id), from, to))
  }

  return { palette, addUsed, removeAdded, moveColor }
}

const removeKey: InjectionKey<(colorId: string) => void> = Symbol('removeAddedColor')

/** The app shell hands out how an added swatch is removed (ticket 228), so the three places that show the Palette
 * needn't pass it down. */
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

const recentsKey: InjectionKey<Readonly<Ref<readonly string[]>>> = Symbol('recentColors')

/** The app shell hands out the recents the Tool pill shows as chips (ticket 529): the Palette leaves those colors out
 * while they are there. */
export function provideRecentColors(recents: Readonly<Ref<readonly string[]>>) {
  provide(recentsKey, recents)
}

/** The colors the pill's chips hold; none when mounted alone. */
export function useRecentColors(): Readonly<Ref<readonly string[]>> {
  return inject(recentsKey, () => ref<readonly string[]>([]), true)
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

/** Pick color from canvas (ticket 398): whether the next press on the canvas takes a bead's color, and how the
 * button arms or disarms it. */
export interface ColorPick {
  picking: Readonly<Ref<boolean>>
  toggle: () => void
}

const colorPickKey: InjectionKey<ColorPick> = Symbol('colorPick')

/** The app shell hands out Pick color from canvas, so the button in the Toolbox and in the Colour sheet share one
 * state. */
export function provideColorPick(pick: ColorPick) {
  provide(colorPickKey, pick)
}

/** Absent (mounted alone) means there is no canvas to pick from, so no button is offered. */
export function useColorPick(): ColorPick | undefined {
  return inject(colorPickKey, undefined)
}

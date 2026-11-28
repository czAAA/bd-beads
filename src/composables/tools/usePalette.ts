import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { addUsedColor, addUsedColors, createPalette, defaultPaletteIds, moveSection as moveSectionOf, moveSlot, projectPalette, removeColor, removeSection as removeSectionOf, restoreColor, CUSTOM_COLORS, type AddUsedColorOutcome, type Palette, type PaletteCode, type PaletteCodes, type PaletteIds } from '../../domain/palette'
import { setPalette as withPalette, setSwatchLetter, withLettersBack } from '../../domain/paletteEdits'
import { withLetter, type SwatchLetters } from '../../domain/swatchLetters'
import { beadsInColors, withBeadsBackIn, withoutBeadsIn } from '../../domain/colorBeads'
import type { Project } from '../../domain/project'
import type { EditFn } from '../project/useEdit'

/** The hexes of the swatches `colorIds` stand for. */
function hexesOf(project: Project, colorIds: readonly string[]): Set<string> {
  return new Set(projectPalette(project).colors.filter((color) => colorIds.includes(color.id)).map((color) => color.hex))
}

/** The catalog codes of the added swatches `colorIds` stand for, so putting a removed swatch back brings its code too (ticket 0538). */
function codesOf(project: Project, colorIds: readonly string[]): PaletteCodes {
  const hexes = projectPalette(project).colors.filter((color) => colorIds.includes(color.id)).map((color) => color.hex)
  return Object.fromEntries(hexes.flatMap((hex) => (project.paletteCodes?.[hex] ? [[hex, project.paletteCodes[hex]!]] : [])))
}

/** The Swatch letters of the swatches `colorIds` stand for, so putting a removed swatch back brings its letter too (ticket 1092). */
function lettersOf(project: Project, colorIds: readonly string[]): SwatchLetters {
  const hexes = projectPalette(project).colors.filter((color) => colorIds.includes(color.id)).map((color) => color.hex)
  return Object.fromEntries(hexes.flatMap((hex) => (project.paletteLetters?.[hex] ? [[hex, project.paletteLetters[hex]!]] : [])))
}

const paletteKey: InjectionKey<ComputedRef<Palette>> = Symbol('palette')

/** What the Palette needs from the app shell: the open Project and Edit, the one way an undoable change reaches it
 * (ADR 0036). */
export interface ProjectPaletteDeps {
  currentProject: () => Project | undefined
  edit: EditFn
}

/** The Palette (CONTEXT.md, ticket 0525, ADR 0002, 0103): the open Project's own colors, its default ones and those
 * that joined it, in their sections in slot order (see Palette). Every change is an Edit, so Undo covers it. Call once from the shell. */
export function useProjectPalette({ currentProject, edit }: ProjectPaletteDeps) {
  const palette = computed(() => {
    const project = currentProject()
    return project ? projectPalette(project) : createPalette(defaultPaletteIds())
  })
  provide(paletteKey, palette)

  /** `letters` are given back to the colors that had them: a removal's Undo (ticket 1092). */
  function setPalette(ids: PaletteIds, codes?: PaletteCodes, letters?: SwatchLetters) {
    edit('exempt', (project) => (letters ? withLettersBack(withPalette(project, ids, codes), letters) : withPalette(project, ids, codes)))
  }

  /** The swatch the last color added was a shade apart from (ticket 1226, ADR 0103): its section and, for a code, the code.
   * The Add another color popover tells it once; the next add, or closing it, takes it away. */
  const nudge = ref<ColorClash>()

  /** A Custom color has been chosen or painted, or a code picked from any Bead's catalog: it joins the Palette on first
   * use, last in its section (ADR 0103). Hands back whether it joined and the swatch it is. */
  function addUsed(hex: string, code?: PaletteCode): { outcome: AddUsedColorOutcome; colorId?: string } {
    const project = currentProject()
    if (!project) return { outcome: 'known' }
    const { ids, outcome, colorId, codes, nudgedFrom } = addUsedColor(project.palette, hex, project.paletteCodes, code)
    nudge.value = nudgedFrom ? { section: nudgedFrom.catalog ?? CUSTOM_COLORS, ...(nudgedFrom.code ? { code: nudgedFrom.code } : {}) } : undefined
    if (outcome === 'added') setPalette(ids, codes)
    return { outcome, colorId }
  }

  /** Several plain colors join the Palette in one Edit (the basic colors' Add all); the paint color stays. */
  function addAll(hexes: readonly string[]) {
    const project = currentProject()
    if (!project) return
    nudge.value = undefined
    const ids = addUsedColors(project.palette, hexes, project.paletteCodes)
    if (ids.length > project.palette.length) setPalette(ids)
  }

  /** A swatch is taken out of the Palette (ticket 228), a default one too (ticket 1226), with every bead painted in it
   * (ticket 1124). Hands back how to put it back, or undefined for a color the Palette doesn't hold. */
  function removeAdded(colorId: string): (() => void) | undefined {
    const project = currentProject()
    const removal = project && removeColor(project.palette, colorId)
    if (!removal) return undefined
    return removeColors(project, removal.ids, [colorId], (now) => restoreColor(now.palette, colorId, removal.slot))
  }

  /** A whole section leaves the Palette in one Edit (ADR 0103, tickets 0532, 1226), its default colors too, with the beads painted in them
   * (ticket 1124). Hands back how to put it back as it stood, or undefined for a section the Palette doesn't show. */
  function removeSection(section: string): (() => void) | undefined {
    const project = currentProject()
    return project && removeAll(project, removeSectionOf(project.palette, project.paletteCodes ?? {}, section))
  }

  /** The colors `removal` took out of `project`'s Palette, and their beads, in one Edit; Undo puts each back in its slot. */
  function removeAll(project: Project, removal: { ids: PaletteIds; removed: { colorId: string; slot: number }[] }): (() => void) | undefined {
    if (removal.removed.length === 0) return undefined
    const colorIds = removal.removed.map(({ colorId }) => colorId)
    const restored = (now: Project) => removal.removed.reduce((ids, { colorId, slot }) => restoreColor(ids, colorId, slot), now.palette)
    return removeColors(project, removal.ids, colorIds, restored)
  }

  /** `colorIds` out of `project`'s Palette, leaving `ids`, and their beads off every layer, in one Edit (ticket 1124).
   * Hands back their Undo: the Palette `restored` gives, their codes and letters, and their beads where still empty. */
  function removeColors(project: Project, ids: PaletteIds, colorIds: readonly string[], restored: (now: Project) => PaletteIds): () => void {
    const hexes = hexesOf(project, colorIds)
    const codes = codesOf(project, colorIds)
    const letters = lettersOf(project, colorIds)
    edit('exempt', (now) => withoutBeadsIn(withPalette(now, ids), hexes))
    return () => edit('exempt', (now) => withBeadsBackIn(withLettersBack(withPalette(now, restored(now), codes), letters), project, hexes))
  }

  /** How many beads the layers show in the swatches `colorIds` stand for: what removing them would take (ticket 1124). */
  function paintedBeads(colorIds: readonly string[]): number {
    const project = currentProject()
    return project ? beadsInColors(project, hexesOf(project, colorIds)) : 0
  }

  /** A swatch dragged (or nudged) from one slot to another (ticket 398); its Shift+key follows the slot it lands in. */
  function moveColor(from: number, to: number) {
    setPalette(moveSlot(palette.value.colors.map((color) => color.id), from, to))
  }

  /** A section moved up or down among the others (ticket 1226): its swatches go with it, and the slots, with their
   * Shift+keys, count across sections in the new order. */
  function moveSection(section: string, by: number) {
    const project = currentProject()
    if (project) setPalette(moveSectionOf(project.palette, project.paletteCodes ?? {}, section, by))
  }

  /** A Palette color's Swatch letter typed by the maker (ticket 1092): one Edit. Hands back the color that had the
   * letter and the one it got instead, or nothing when no other color had it. */
  function setLetter(hex: string, letter: string): LetterSwap | undefined {
    const letters = currentProject()?.paletteLetters
    const changed = letters && withLetter(letters, hex, letter)
    if (!changed) return undefined
    edit('exempt', (project) => setSwatchLetter(project, hex, letter))
    return changed.swapped
  }

  return { palette, addUsed, addAll, nudge, clearNudge: () => (nudge.value = undefined), removeAdded, removeSection, paintedBeads, moveColor, moveSection, setLetter }
}

/** The swatch an added color clashed with (ticket 1226): the section it is in, and its code when it has one. */
export interface ColorClash {
  section: string
  code?: string
}

/** The color a typed letter was taken from, and the letter it got in trade (ticket 1092). */
export interface LetterSwap {
  hex: string
  letter: string
}

/** The Palette's Swatch letters as its controls need them (ticket 1092): each color's letter, whether the Canvas's
 * Letters switch shows them on the swatches and the Canvas's beads, and how a letter is changed. */
export interface PaletteLetters {
  letters: Readonly<Ref<SwatchLetters>>
  shown: Readonly<Ref<boolean>>
  setShown: (on: boolean) => void
  setLetter: (hex: string, letter: string) => LetterSwap | undefined
}

const lettersKey: InjectionKey<PaletteLetters | undefined> = Symbol('paletteLetters')

/** The app shell hands out the open Project's Swatch letters to the Palette's controls; a host whose Palette is not
 * that Project's (the Convert image wizard's remap picker) hands out none, so its swatches carry no letters. */
export function providePaletteLetters(letters: PaletteLetters | undefined) {
  provide(lettersKey, letters)
}

/** Absent (mounted alone, or the Convert image wizard's Palette) means no letters are shown or changed. */
export function usePaletteLetters(): PaletteLetters | undefined {
  return inject(lettersKey, undefined)
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

/** A Palette that is not the open Project's, for the swatch components under the caller: the Convert image wizard's
 * remap picker shows the Palette the new Project will get (spec 0645). */
export function providePalette(palette: ComputedRef<Palette>) {
  provide(paletteKey, palette)
}

/** The Palette for a swatch component: a new Project's when no app shell provides one (mounted alone). */
export function usePalette(): ComputedRef<Palette> {
  return inject(paletteKey, () => computed(() => createPalette(defaultPaletteIds())), true)
}

const recentsKey: InjectionKey<Readonly<Ref<readonly string[]>>> = Symbol('recentColors')

/** The app shell hands out the recents the Tool pill shows as chips (ticket 529): the Palette keeps those colors in
 * their slots and rings them (ticket 0865). */
export function provideRecentColors(recents: Readonly<Ref<readonly string[]>>) {
  provide(recentsKey, recents)
}

/** The colors the pill's chips hold; none when mounted alone. */
export function useRecentColors(): Readonly<Ref<readonly string[]>> {
  return inject(recentsKey, () => ref<readonly string[]>([]), true)
}

const nudgeKey: InjectionKey<{ nudge: Readonly<Ref<ColorClash | undefined>>; clear: () => void }> = Symbol('colorNudge')

/** The app shell hands out what the last added color was a shade apart from, for the Add another color popover's note (ticket 1226). */
export function provideColorNudge(nudge: Readonly<Ref<ColorClash | undefined>>, clear: () => void) {
  provide(nudgeKey, { nudge, clear })
}

/** Absent (mounted alone) means no note is told. */
export function useColorNudge() {
  return inject(nudgeKey, () => ({ nudge: ref<ColorClash>(), clear: () => {} }), true)
}

const addAllKey: InjectionKey<(hexes: readonly string[]) => void> = Symbol('addAllColors')

/** The app shell hands out how several colors join the Palette at once, for the basic colors' Add all. */
export function provideAddAllColors(addAll: (hexes: readonly string[]) => void) {
  provide(addAllKey, addAll)
}

/** Absent (mounted alone) means no Add all is offered. */
export function useAddAllColors(): ((hexes: readonly string[]) => void) | undefined {
  return inject(addAllKey, undefined)
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

const moveSectionKey: InjectionKey<(section: string, by: number) => void> = Symbol('moveSection')

/** The app shell hands out how a section moves among the others (ticket 1226). */
export function provideMoveSection(move: (section: string, by: number) => void) {
  provide(moveSectionKey, move)
}

/** How a section's label line asks to move; absent (mounted alone) means the sections can't be rearranged. */
export function useMoveSection(): ((section: string, by: number) => void) | undefined {
  return inject(moveSectionKey, undefined)
}

const removeSectionKey: InjectionKey<(section: string) => void> = Symbol('removeSection')

/** The app shell hands out how a section asks to be removed, after a question (ticket 1226). */
export function provideRemoveSection(remove: (section: string) => void) {
  provide(removeSectionKey, remove)
}

/** How a section's Remove asks; absent (mounted alone) means no section offers removal. */
export function useRemoveSection(): ((section: string) => void) | undefined {
  return inject(removeSectionKey, undefined)
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

import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { BeadMap } from '../../domain/canvas'
import { addedColorId } from '../../domain/palette'
import { createProject } from '../../domain/createProject'
import { lettersOfPalette } from '../../domain/paletteEdits'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useProjectPalette } from '../tools/usePalette'
import { useRemoveColorFlow } from './useRemoveColorFlow'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const A = addedColorId('#123456')
const B = addedColorId('#abcdef')

/** A Project whose Palette holds these ids and whose Canvas holds `beads`, the real Palette and Edit over it, and
 * `selected` as the chosen color. */
function setup(ids: string[] = [...[...base.palette], A, B], selected?: string, beads: BeadMap = {}) {
  // Every swatch has its Swatch letter, as a Palette the app made does.
  const layers: typeof base.layers = [{ ...base.layers[0], beads }]
  const harness = editHarness({ ...base, layers, palette: ids, paletteLetters: lettersOfPalette(ids, 'toho-cube-1.5mm', base.paletteLetters) })
  const { palette, removeAdded, removeAllAdded, paintedBeads } = useProjectPalette({ currentProject: harness.currentProject, edit: harness.edit })
  const selectedColorId = ref(selected)
  const deps = {
    palette,
    removeAdded,
    removeAllAdded,
    paintedBeads,
    selectedColorId,
    onSelectColor: vi.fn((colorId: string) => (selectedColorId.value = colorId)),
    showToast: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
  }
  /** Presses the Undo in the last toast shown. */
  const undoInToast = () => deps.showToast.mock.lastCall![3].run()
  return { harness, palette, deps, selectedColorId, undoInToast, ...useRemoveColorFlow(deps) }
}

describe('removing an added swatch (tickets 228, 304)', () => {
  it('asks first, naming the color, and Cancel removes nothing', () => {
    const { harness, deps, pendingColorRemovalHex, onRequestRemoveAddedColor, onCancelRemoveAddedColor } = setup()
    onRequestRemoveAddedColor(A)
    expect(pendingColorRemovalHex.value).toBe('#123456')
    onCancelRemoveAddedColor()
    expect(pendingColorRemovalHex.value).toBeUndefined()
    expect(harness.history.canUndo.value).toBe(false)
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('confirming removes it as one Edit, steps back to the default color, and the toast\'s Undo puts it back in its slot, selected', () => {
    const [first, ...rest] = [...base.palette]
    const ids = [first!, A, ...rest, B]
    const { harness, palette, deps, selectedColorId, undoInToast, onRequestRemoveAddedColor, onConfirmRemoveAddedColor } = setup(ids, A)
    onRequestRemoveAddedColor(A)
    onConfirmRemoveAddedColor()
    expect(harness.project.palette).toEqual(ids.filter((id) => id !== A))
    expect(selectedColorId.value).toBe(palette.value.defaultColorId)
    expect(deps.showToast).toHaveBeenCalledWith(`palette-removed-${A}`, en.palette.removed, 'info', expect.objectContaining({ label: en.palette.undoButton }))
    undoInToast()
    expect(harness.project.palette).toEqual(ids)
    expect(selectedColorId.value).toBe(A)
    harness.history.onUndo()
    harness.history.onUndo()
    expect(harness.project.palette).toEqual(ids)
  })

  it('removes at once, with no question, where a press is a toggle: the same Edit, toast and Undo (ticket 1092)', () => {
    const { harness, palette, deps, selectedColorId, undoInToast, pendingColorRemovalId, onRemoveAddedColor } = setup(undefined, A)
    const before = harness.project.palette
    onRemoveAddedColor(A)
    expect(pendingColorRemovalId.value).toBeUndefined()
    expect(harness.project.palette).toEqual(before.filter((id) => id !== A))
    expect(selectedColorId.value).toBe(palette.value.defaultColorId)
    expect(deps.showToast).toHaveBeenCalledWith(`palette-removed-${A}`, en.palette.removed, 'info', expect.objectContaining({ label: en.palette.undoButton }))
    undoInToast()
    expect(harness.project.palette).toEqual(before)
  })

  it('gives a color put back by the toast\'s Undo the letter the maker gave it, unless another color took it since (ticket 1092)', () => {
    const { harness, undoInToast, onRemoveAddedColor } = setup()
    const { setLetter } = useProjectPalette({ currentProject: harness.currentProject, edit: harness.edit })
    setLetter('#123456', 'Q')
    onRemoveAddedColor(A)
    undoInToast()
    expect(harness.project.paletteLetters!['#123456']).toBe('Q')

    onRemoveAddedColor(A)
    setLetter('#abcdef', 'Q')
    undoInToast()
    expect(harness.project.paletteLetters!['#abcdef']).toBe('Q')
    expect(harness.project.paletteLetters!['#123456']).not.toBe('Q')
  })

  it('leaves the chosen color alone when another swatch is removed, and its Undo selects nothing', () => {
    const { deps, selectedColorId, undoInToast, onRequestRemoveAddedColor, onConfirmRemoveAddedColor } = setup(undefined, B)
    onRequestRemoveAddedColor(A)
    onConfirmRemoveAddedColor()
    undoInToast()
    expect(selectedColorId.value).toBe(B)
    expect(deps.onSelectColor).not.toHaveBeenCalled()
  })

  it('confirming with nothing pending does nothing', () => {
    const { harness, onConfirmRemoveAddedColor } = setup()
    onConfirmRemoveAddedColor()
    expect(harness.history.canUndo.value).toBe(false)
  })
})

describe('removing every added color (ticket 0532)', () => {
  it('asks first, naming how many leave, and Cancel removes nothing', () => {
    const { harness, removeAllColorsConfirmOpen, removeAllColorsMessage, onRequestRemoveAllAddedColors, onCancelRemoveAllAddedColors } = setup([A, ...[...base.palette], B, addedColorId('#fedcba')])
    onRequestRemoveAllAddedColors()
    expect(removeAllColorsConfirmOpen.value).toBe(true)
    expect(removeAllColorsMessage.value).toBe('3 colors will leave the Palette.')
    onCancelRemoveAllAddedColors()
    expect(removeAllColorsConfirmOpen.value).toBe(false)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('confirming removes them all as one Edit, steps back to the default color, and one Undo in the toast puts each back in its slot, selected', () => {
    const [first, ...rest] = [...base.palette]
    const ids = [A, first!, B, ...rest]
    const { harness, palette, deps, selectedColorId, undoInToast, onRequestRemoveAllAddedColors, onConfirmRemoveAllAddedColors, removeAllColorsConfirmOpen } = setup(ids, B)
    onRequestRemoveAllAddedColors()
    onConfirmRemoveAllAddedColors()
    expect(removeAllColorsConfirmOpen.value).toBe(false)
    expect(harness.project.palette).toEqual([...base.palette])
    expect(selectedColorId.value).toBe(palette.value.defaultColorId)
    expect(deps.showToast).toHaveBeenCalledWith('palette-removed-all', en.palette.removedAll, 'info', expect.objectContaining({ label: en.palette.undoButton }))
    harness.history.onUndo()
    expect(harness.project.palette).toEqual(ids)
    harness.history.onRedo()
    undoInToast()
    expect(harness.project.palette).toEqual(ids)
    expect(selectedColorId.value).toBe(B)
  })

  it('Undo does not select the color again when another was chosen since', () => {
    const { selectedColorId, deps, undoInToast, onConfirmRemoveAllAddedColors } = setup(undefined, A)
    onConfirmRemoveAllAddedColors()
    deps.onSelectColor('red')
    undoInToast()
    expect(selectedColorId.value).toBe('red')
  })

  it('keeps a built-in color chosen', () => {
    const { selectedColorId, onConfirmRemoveAllAddedColors } = setup(undefined, 'red')
    onConfirmRemoveAllAddedColors()
    expect(selectedColorId.value).toBe('red')
  })

  it('is no Edit and shows no toast with no added color', () => {
    const { harness, deps, onConfirmRemoveAllAddedColors } = setup([...base.palette])
    onConfirmRemoveAllAddedColors()
    expect(harness.history.canUndo.value).toBe(false)
    expect(deps.showToast).not.toHaveBeenCalled()
  })
})

describe('removing a color beads are painted in (ticket 1124)', () => {
  const painted: BeadMap = { 0: { 0: '#123456', 1: '#123456', 2: '#abcdef' }, 1: { 1: '#123456' } }

  it('names the color alone when nothing is painted in it', () => {
    const { removeColorMessage, onRequestRemoveAddedColor } = setup()
    onRequestRemoveAddedColor(A)
    expect(removeColorMessage.value).toBe('#123456 will leave the Palette.')
  })

  it('names how many beads go with it, and confirming takes the color and its beads off as one Undo step', () => {
    const { harness, removeColorMessage, onRequestRemoveAddedColor, onConfirmRemoveAddedColor } = setup(undefined, undefined, painted)
    onRequestRemoveAddedColor(A)
    expect(removeColorMessage.value).toBe('#123456 will leave the Palette. The 3 beads painted in it go too.')
    onConfirmRemoveAddedColor()
    expect(harness.project.palette).not.toContain(A)
    expect(harness.project.layers[0].beads).toEqual({ 0: { 2: '#abcdef' } })
    harness.history.onUndo()
    expect(harness.project.palette).toContain(A)
    expect(harness.project.layers[0].beads).toEqual(painted)
  })

  it("puts the beads back with the color from the toast's Undo, where their places are still empty", () => {
    const { harness, undoInToast, onRemoveAddedColor } = setup(undefined, undefined, painted)
    onRemoveAddedColor(A)
    harness.edit('drawing', (project) => ({ ...project, layers: [{ ...project.layers[0], beads: { ...project.layers[0].beads, 1: { 1: '#abcdef' } } }] }))
    undoInToast()
    expect(harness.project.palette).toContain(A)
    expect(harness.project.layers[0].beads).toEqual({ 0: { 0: '#123456', 1: '#123456', 2: '#abcdef' }, 1: { 1: '#abcdef' } })
  })

  it('asks first where a press would remove it at once', () => {
    const { harness, pendingColorRemovalId, onRemoveAddedColorOrAsk } = setup(undefined, undefined, painted)
    onRemoveAddedColorOrAsk(A)
    expect(pendingColorRemovalId.value).toBe(A)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('removes at once where a press would and nothing is painted in it', () => {
    const { harness, pendingColorRemovalId, onRemoveAddedColorOrAsk } = setup(undefined, undefined, painted)
    onRemoveAddedColorOrAsk(addedColorId('#fedcba'))
    expect(pendingColorRemovalId.value).toBeUndefined()
    const { harness: plain, onRemoveAddedColorOrAsk: removeOrAsk } = setup()
    removeOrAsk(A)
    expect(plain.project.palette).not.toContain(A)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('names the beads of every added color when all of them go, and takes them all off', () => {
    const { harness, removeAllColorsMessage, onConfirmRemoveAllAddedColors } = setup(undefined, undefined, painted)
    expect(removeAllColorsMessage.value).toBe('2 colors will leave the Palette. The 4 beads painted in them go too.')
    onConfirmRemoveAllAddedColors()
    expect(harness.project.layers[0].beads).toEqual({})
  })
})

import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
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

/** A Project whose Palette holds these ids, the real Palette and Edit over it, and `selected` as the chosen color. */
function setup(ids: string[] = [...[...base.palette], A, B], selected?: string) {
  // Every swatch has its Swatch letter, as a Palette the app made does.
  const harness = editHarness({ ...base, palette: ids, paletteLetters: lettersOfPalette(ids, 'toho-cube-1.5mm', base.paletteLetters) })
  const { palette, removeAdded, removeAllAdded } = useProjectPalette({ currentProject: harness.currentProject, edit: harness.edit })
  const selectedColorId = ref(selected)
  const deps = {
    palette,
    removeAdded,
    removeAllAdded,
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
    expect(removeAllColorsMessage.value).toBe('3 colors will leave the Palette. Painted cells keep their color.')
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

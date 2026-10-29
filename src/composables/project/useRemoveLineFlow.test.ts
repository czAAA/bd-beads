import { describe, expect, it } from 'vitest'
import { createProject } from '../../domain/createProject'
import { moveToRow, rowProgressOf } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { editHarness } from '../../testUtils/editHarness'
import { useDialogs } from '../shell/useDialogs'
import { en } from '../../i18n/en'
import { useRemoveLineFlow } from './useRemoveLineFlow'
import { frameOf } from '../../domain/layerRecord'
import { frameSheetOf, withLayers } from '../../testUtils/layerFields'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const secondRow: Selection = { top: 1, left: 0, rows: 1, columns: 4 }

function setup(options: { project?: Project | null; selection?: Selection } = {}) {
  const project = options.project === null ? undefined : (options.project ?? base)
  const harness = editHarness(project)
  const dialogs = useDialogs()
  const flow = useRemoveLineFlow({ currentProject: harness.currentProject, edit: harness.edit, selection: () => options.selection, dialogs, messages: () => en, locale: () => 'en' })
  return { harness, dialogs, ...flow }
}

describe('useRemoveLineFlow', () => {
  it('is available only when the Selection marks out a whole line of the Frame', () => {
    expect(setup({ selection: secondRow }).canRemoveSelectedLine.value).toBe(true)
    expect(setup().canRemoveSelectedLine.value).toBe(false)
    expect(setup({ project: null, selection: secondRow }).canRemoveSelectedLine.value).toBe(false)
  })

  it('removes a line clear of finished passes without asking once rows are marked done (ticket 0647)', () => {
    const woven = moveToRow(base, 1)
    const { harness, dialogs, canRemoveSelectedLine, onRemoveSelectedLine } = setup({ project: woven, selection: secondRow })
    expect(canRemoveSelectedLine.value).toBe(true)
    onRemoveSelectedLine()
    expect(dialogs.open.value).toBeUndefined()
    expect(frameOf(harness.project)).toMatchObject({ rows: 2 })
    expect(rowProgressOf(harness.project).currentRow).toBe(1)
  })

  it('asks before a finished row, then takes it and moves the pointer back, one Undo bringing both back (ticket 0647)', () => {
    const woven = moveToRow(base, 2)
    const { harness, dialogs, onRemoveSelectedLine, confirmRemoveLine } = setup({ project: woven, selection: secondRow })
    onRemoveSelectedLine()
    expect(dialogs.open.value).toBe('remove-line')
    expect(dialogs.question('remove-line').value).toEqual({ kind: 'finished-row', row: 2, backTo: 2, shifts: false, direction: 'rows' })
    expect(harness.replaceProject).not.toHaveBeenCalled()

    confirmRemoveLine()
    expect(dialogs.open.value).toBeUndefined()
    expect(frameOf(harness.project)).toMatchObject({ rows: 2 })
    expect(rowProgressOf(harness.project).currentRow).toBe(1)

    harness.history.onUndo()
    expect(frameSheetOf(harness.project)).toEqual(frameSheetOf(woven))
    expect(rowProgressOf(harness.project)).toEqual(rowProgressOf(woven))
  })

  it('words the question for the line it asks about, rows or columns as the rows run (ticket 0647)', () => {
    const { removeLinePrompt, onRemoveSelectedLine } = setup({ project: moveToRow(base, 2), selection: secondRow })
    onRemoveSelectedLine()
    expect(removeLinePrompt.value).toEqual({ title: 'Remove row?', message: 'Row 2 is already woven. Removing it moves Row progress back to row 2.' })

    const peyote: Project = withLayers(base, { technique: 'peyote', frame: { ...frameOf(base)!, technique: 'peyote' }, rowProgress: { direction: 'columns', currentRow: 0, currentColumn: 3 } })
    const firstColumn: Selection = { top: 0, left: 1, rows: 3, columns: 1 }
    const columns = setup({ project: peyote, selection: firstColumn })
    columns.onRemoveSelectedLine()
    expect(columns.removeLinePrompt.value).toEqual({ title: 'Remove column?', message: 'Column 2 is already woven. Removing it moves Row progress back to column 2. The columns after it shift.' })

    const across = setup({ project: moveToRow(base, 2), selection: { top: 0, left: 1, rows: 3, columns: 1 } })
    across.onRemoveSelectedLine()
    expect(across.removeLinePrompt.value).toEqual({ title: 'Remove column?', message: 'This takes a bead out of each of the 2 woven rows.' })
  })

  it('leaves everything as it was when the question is answered No (ticket 0647)', () => {
    const { harness, dialogs, onRemoveSelectedLine, cancelRemoveLine } = setup({ project: moveToRow(base, 2), selection: secondRow })
    onRemoveSelectedLine()
    cancelRemoveLine()
    expect(dialogs.open.value).toBeUndefined()
    expect(harness.replaceProject).not.toHaveBeenCalled()
  })

  it('removes the line, resets the session, and Undo brings the Frame back', () => {
    const { harness, onRemoveSelectedLine } = setup({ selection: secondRow })
    onRemoveSelectedLine()

    expect(frameOf(harness.project)).toMatchObject({ columns: 4, rows: 2 })
    expect(harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)

    harness.history.onUndo()
    expect(frameSheetOf(harness.project)).toEqual(frameSheetOf(base))
  })

  it('does nothing without a line selected', () => {
    const { harness, onRemoveSelectedLine } = setup()
    onRemoveSelectedLine()
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.replaceProject).not.toHaveBeenCalled()
  })
})

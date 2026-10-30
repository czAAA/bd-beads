import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { colorAt } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { frameOf } from '../../domain/layerRecord'
import { MIRROR_OFF, type MirrorSetting } from '../../domain/mirror'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { paintAt } from '../../testUtils/layers'
import { frameSheetOf } from '../../testUtils/layerFields'
import { useMirrorSelectionFlow } from './useMirrorSelectionFlow'

const RED = '#e63746'
/** A 6 x 4 loom Frame at the origin with one red bead at its top-left corner. */
const framed: Project = paintAt(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 6, height: 4, unit: 'beads' } }), [{ row: 0, column: 0 }], RED)
const corner: Selection = { top: 0, left: 0, rows: 1, columns: 1 }
const leftRight: MirrorSetting = { ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, leftRight: true } }
const topBottom: MirrorSetting = { ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, topBottom: true } }

function setup(project: Project = framed, setting: MirrorSetting = leftRight, selection: Selection | null = corner) {
  const harness = editHarness(project)
  const deps = {
    edit: harness.edit,
    selection: ref<Selection | undefined>(selection ?? undefined),
    mirror: () => setting,
    announce: vi.fn(),
    showToast: vi.fn(),
    onUndo: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
  }
  return { deps, harness, ...useMirrorSelectionFlow(deps) }
}

describe('useMirrorSelectionFlow', () => {
  it('copies the fragment to its counterparts as one drawing step, keeps the Selection, announces it, and Undo takes it back', () => {
    const { deps, harness, onMirrorSelection } = setup()
    onMirrorSelection()

    expect(colorAt(frameOf(harness.project)!.beads, 0, 5)).toBe(RED)
    expect(deps.selection.value).toEqual(corner)
    expect(deps.announce).toHaveBeenCalledWith('Fragment mirrored')
    expect(deps.showToast).not.toHaveBeenCalled()

    harness.history.onUndo()
    expect(frameSheetOf(harness.project)).toEqual(frameSheetOf(framed))
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('shows one Message counting the counterparts that were dropped, with Undo', () => {
    // Row 0 is finished: the bead at row 3 has its one image there, so nothing lands and there is no Undo to offer.
    const project = moveToRow(paintAt(framed, [{ row: 3, column: 0 }], RED), 1)
    const { deps, harness, onMirrorSelection } = setup(project, topBottom, { top: 3, left: 0, rows: 1, columns: 1 })
    onMirrorSelection()

    expect(harness.project).toBe(project)
    expect(deps.showToast).toHaveBeenCalledWith('selection-mirrored', '1 counterpart had nowhere to land and was left out.', 'info', undefined)
    expect(deps.announce).not.toHaveBeenCalled()
  })

  it('does nothing without a Selection or while Mirror is off', () => {
    const off = setup(framed, MIRROR_OFF)
    off.onMirrorSelection()
    expect(off.harness.history.canUndo.value).toBe(false)

    const none = setup(framed, leftRight, null)
    none.onMirrorSelection()
    expect(none.harness.history.canUndo.value).toBe(false)
    expect(none.deps.announce).not.toHaveBeenCalled()
  })
})

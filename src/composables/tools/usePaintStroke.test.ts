import { describe, expect, it, vi } from 'vitest'
import { colorAt } from '../../domain/canvas'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { createProject, moveToRow, setRowProgressEnabled, type Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import { editHarness } from '../../testUtils/editHarness'
import { usePaintStroke } from './usePaintStroke'

function setup(tool: Tool = 'paint', initial?: Project) {
  const harness = editHarness(
    initial ?? createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } }),
  )
  const endSelectPress = vi.fn()
  const stroke = usePaintStroke({
    currentProject: harness.currentProject,
    edit: harness.editing,
    mirrorAxisCounts: () => NO_MIRROR_AXES,
    mirrorCopyMode: () => false,
    activeTool: () => tool,
    endSelectPress,
  })
  const at = (row: number, column: number) => colorAt(harness.project.beads, harness.project.frame!.row + row, harness.project.frame!.column + column)
  return { stroke, harness, endSelectPress, at, frame: harness.project.frame! }
}

describe('usePaintStroke', () => {
  it('turns a whole drag into one undo step and one save', () => {
    const { stroke, harness, frame } = setup()
    const { row, column } = frame

    stroke.beginOrCommitPress('paint', '#ff0000', row, column)
    expect(stroke.strokeMode.value).toBe('paint')
    stroke.paintStrokeCell(row, column + 1, '#ff0000')
    stroke.paintStrokeCell(row, column + 2, '#ff0000')
    expect(harness.replaceProject).toHaveBeenCalledTimes(3)
    expect(harness.replaceProject).toHaveBeenCalledWith(expect.anything(), { deferSave: true })
    expect(harness.history.canUndo.value).toBe(false)

    stroke.endStroke()
    expect(harness.flushPendingSave).toHaveBeenCalledTimes(1)
    expect(stroke.strokeMode.value).toBeNull()

    harness.history.onUndo()
    expect(Object.keys(harness.project.beads)).toHaveLength(0)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('leaves finished rows alone', () => {
    const { stroke, at, frame } = setup('paint', moveToRow(setRowProgressEnabled(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } }), true), 1))
    stroke.beginOrCommitPress('paint', '#ff0000', frame.row, frame.column)
    stroke.paintStrokeCell(frame.row + 1, frame.column, '#ff0000')
    stroke.endStroke()

    expect(at(0, 0)).toBeNull()
    expect(at(1, 0)).toBe('#ff0000')
  })

  it('ends a Select press and flushes even when no stroke was running', () => {
    const { stroke, harness, endSelectPress } = setup()
    stroke.endStroke()
    expect(endSelectPress).toHaveBeenCalled()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('commits Fill immediately as one undo step, without starting a stroke', () => {
    const { stroke, harness, at, frame } = setup('fill')
    stroke.beginOrCommitPress('paint', '#00ff00', frame.row + 1, frame.column + 1)
    expect(stroke.strokeMode.value).toBeNull()
    expect(at(1, 1)).toBe('#00ff00')
    expect(harness.history.canUndo.value).toBe(true)

    harness.history.onUndo()
    expect(at(1, 1)).toBeNull()
  })
})

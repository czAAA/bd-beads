import { describe, expect, it, vi } from 'vitest'
import { beadColorAt } from '../../domain/layerBeads'
import { changeFrame } from '../../domain/changeFrame'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { paintAt } from '../../testUtils/layers'
import type { Tool } from '../../domain/tool'
import { editHarness } from '../../testUtils/editHarness'
import { usePaintStroke } from './usePaintStroke'
import { beadsOfLayer, frameOf, withFrameSheet } from '../../domain/layerRecord'

function setup(tool: Tool = 'paint', initial?: Project) {
  const harness = editHarness(
    initial ?? createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } }),
  )
  const endSelectPress = vi.fn()
  const stroke = usePaintStroke({
    currentProject: harness.currentProject,
    edit: harness.editing,
    activeTool: () => tool,
    endSelectPress,
  })
  const at = (row: number, column: number) => beadColorAt(harness.project, frameOf(harness.project)!.row + row, frameOf(harness.project)!.column + column)
  return { stroke, harness, endSelectPress, at, frame: frameOf(harness.project)! }
}

describe('usePaintStroke', () => {
  it('cancels a stroke: the bead a finger painted before a pinch is taken back, with no undo step', () => {
    const { stroke, harness, frame, at } = setup()
    const { row, column } = frame

    stroke.beginOrCommitPress('paint', '#ff0000', row, column)
    expect(at(0, 0)).toBe('#ff0000')
    stroke.cancelStroke()

    expect(at(0, 0)).toBeNull()
    expect(stroke.strokeMode.value).toBeNull()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('cancels an erase stroke and a drag over several beads, and ends a Select press', () => {
    const { stroke, harness, endSelectPress, at, frame } = setup('paint', undefined)
    const { row, column } = frame
    harness.edit('drawing', (project) => paintAt(project, [{ row, column }], '#0000ff'))
    const painted = frameOf(harness.project)!.beads

    stroke.beginOrCommitPress('erase', null, row, column)
    stroke.paintStrokeCell(row, column + 1, '#00ff00')
    stroke.paintStrokeCell(row, column + 2, '#00ff00')
    expect(at(0, 0)).toBeNull()
    stroke.cancelStroke()

    expect(frameOf(harness.project)!.beads).toEqual(painted)
    expect(at(0, 0)).toBe('#0000ff')
    expect(endSelectPress).toHaveBeenCalled()
  })

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
    expect(Object.keys(frameOf(harness.project)!.beads)).toHaveLength(0)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('leaves finished rows alone', () => {
    const { stroke, at, frame } = setup('paint', moveToRow(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } }), 1))
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

  it('erases just the pressed bead under the Eraser, not its same-color neighbours, as one undo step', () => {
    const { stroke, harness, at, frame } = setup('erase')
    harness.edit('drawing', (project) => paintAt(project, [{ row: frame.row, column: frame.column }, { row: frame.row, column: frame.column + 1 }], '#00ff00'))

    stroke.beginOrCommitPress('erase', null, frame.row, frame.column)
    stroke.endStroke()
    expect([at(0, 0), at(0, 1)]).toEqual([null, '#00ff00'])

    harness.history.onUndo()
    expect(at(0, 0)).toBe('#00ff00')
  })

  it('flood-erases the connected region in one click under Fill, as one undo step', () => {
    const { stroke, harness, at, frame } = setup('fill')
    stroke.beginOrCommitPress('paint', '#00ff00', frame.row, frame.column)
    expect(at(0, 2)).toBe('#00ff00')

    stroke.beginOrCommitPress('erase', null, frame.row + 1, frame.column + 1)
    expect(stroke.strokeMode.value).toBeNull()
    expect(at(0, 0)).toBeNull()
    expect(at(2, 2)).toBeNull()

    harness.history.onUndo()
    expect(at(0, 0)).toBe('#00ff00')
  })

  describe('layers (ADR 0066)', () => {
    /** A 3 x 3 Frame at (20, 20), far from the margin of a Canvas sketch at the origin. */
    const over = () => {
      const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
      return { ...base, frame: { ...frameOf(base)!, row: 20, column: 20 } }
    }

    it('paints the Frame for a press inside it, and a stroke that began there leaves nothing where it goes outside', () => {
      const { stroke, harness } = setup('paint', over())

      stroke.beginOrCommitPress('paint', '#ff0000', 20, 20)
      stroke.paintStrokeCell(20, 21, '#ff0000')
      stroke.paintStrokeCell(20, 30, '#ff0000')
      stroke.paintStrokeCell(5, 5, '#ff0000')
      stroke.endStroke()

      expect(frameOf(harness.project)!.beads).toEqual({ 0: { 0: '#ff0000', 1: '#ff0000' } })
      expect(beadsOfLayer(harness.project, 'canvas')).toEqual({})
    })

    it('paints the Canvas for a press outside the Frame, and a stroke that began there does not enter the Frame', () => {
      const { stroke, harness } = setup('paint', over())

      stroke.beginOrCommitPress('paint', '#ff0000', 5, 5)
      stroke.paintStrokeCell(5, 6, '#ff0000')
      stroke.paintStrokeCell(21, 21, '#ff0000')
      stroke.endStroke()

      expect(beadsOfLayer(harness.project, 'canvas')).toEqual({ 5: { 5: '#ff0000', 6: '#ff0000' } })
      expect(frameOf(harness.project)!.beads).toEqual({})
    })

    it('paints a Custom frame\'s bead named past its rectangle, as its layout has one there (ticket 0629)', () => {
      const open = withFrameSheet(over(), undefined)
      const placed = changeFrame(open, { custom: { shape: 'triangle', size: 9, centre: { row: 20, column: 30 } } })
      if (placed.kind !== 'changed') throw new Error('expected a Triangle')
      const { stroke, harness } = setup('paint', placed.project)
      const { row, column, columns } = frameOf(harness.project)!
      // The outer round of a Triangle of 9 rounds has 27 places, more than its rectangle has columns.
      expect(columns).toBeLessThan(27)

      stroke.beginOrCommitPress('paint', '#ff0000', row + 8, column + 26, 'frame')
      stroke.endStroke()

      expect(frameOf(harness.project)!.beads).toEqual({ 8: { 26: '#ff0000' } })
    })

    it('fills and erases the layer the press is on, as one undo step each', () => {
      const { stroke, harness } = setup('fill', over())
      stroke.beginOrCommitPress('paint', '#00ff00', 21, 21)
      expect(Object.values(frameOf(harness.project)!.beads).flatMap((row) => Object.keys(row))).toHaveLength(9)
      expect(beadsOfLayer(harness.project, 'canvas')).toEqual({})

      harness.history.onUndo()
      expect(frameOf(harness.project)!.beads).toEqual({})
    })
  })

  it('leaves a stroke on the layer it began on when the pointer crosses to the other (ADR 0066)', () => {
    const { stroke, harness, frame } = setup()
    const { row, column } = frame

    stroke.beginOrCommitPress('paint', '#ff0000', row, column, 'frame')
    stroke.paintStrokeCell(row, column + 1, '#ff0000', 'canvas')
    stroke.paintStrokeCell(row, column + 2, '#ff0000', 'frame')
    stroke.endStroke()

    expect(frameOf(harness.project)!.beads[0]).toEqual({ 0: '#ff0000', 2: '#ff0000' })
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual({})
  })
})


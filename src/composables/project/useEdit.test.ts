import { describe, expect, it } from 'vitest'
import { changeFrame } from '../../domain/changeFrame'
import { colorAt } from '../../domain/canvas'
import { beadColorAt } from '../../domain/layerBeads'
import { deleteAll } from '../../domain/drawing'
import { createProject } from '../../domain/createProject'
import { moveToRow, rowProgressOf, rowProgressOn } from '../../domain/rowProgress'
import { replaceBead } from '../../domain/projectBead'
import type { Project } from '../../domain/project'
import { BEAD_CATALOG } from '../../domain/beads'
import { editHarness } from '../../testUtils/editHarness'
import { paintAt } from '../../testUtils/layers'
import { beadsOfLayer, canvasOf, frameOf } from '../../domain/layerRecord'
import { sheetOf, withFields } from '../../testUtils/flatFields'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })
const frame = frameOf(base)!
const inside = (row: number, column: number) => ({ row: frame.row + row, column: frame.column + column })
const marginCell = { row: frame.row - 1, column: frame.column }

function paint(project: Project, at: { row: number; column: number }, color: string | null = '#ff0000') {
  return paintAt(project, [at], color)
}

describe('useEdit', () => {
  describe('a drawing edit', () => {
    it('lands on the Project, and Undo brings it back', () => {
      const ctx = editHarness(base)
      const outcome = ctx.edit('drawing', (project) => paint(project, inside(0, 0)))

      expect(outcome).toEqual({ kind: 'applied' })
      expect(beadColorAt(ctx.project, inside(0, 0).row, inside(0, 0).column)).toBe('#ff0000')

      ctx.history.onUndo()
      expect(frameOf(ctx.project)!.beads).toEqual(frameOf(base)!.beads)
      ctx.history.onRedo()
      expect(beadColorAt(ctx.project, inside(0, 0).row, inside(0, 0).column)).toBe('#ff0000')
    })

    it('is no Undo step when it leaves no effect', () => {
      const ctx = editHarness(base)
      expect(ctx.edit('drawing', (project) => project)).toEqual({ kind: 'unchanged' })
      expect(ctx.history.canUndo.value).toBe(false)
      expect(ctx.replaceProject).not.toHaveBeenCalled()
    })

    it('leaves finished rows alone and keeps the rest of the edit', () => {
      const woven = moveToRow(base, 1)
      const ctx = editHarness(woven)
      ctx.edit('drawing', (project) => paintAt(project, [inside(0, 0), inside(1, 0)], '#ff0000'))

      expect(beadColorAt(ctx.project, inside(0, 0).row, inside(0, 0).column)).toBeNull()
      expect(beadColorAt(ctx.project, inside(1, 0).row, inside(1, 0).column)).toBe('#ff0000')
    })

    it('is refused silently when it only touched finished rows', () => {
      const ctx = editHarness(moveToRow(base, 1))
      expect(ctx.edit('drawing', (project) => paint(project, inside(0, 0)))).toEqual({ kind: 'unchanged' })
      expect(ctx.history.canUndo.value).toBe(false)
    })

    it('drops what lands in the margin, but erasing there still works', () => {
      const ctx = editHarness(base)
      expect(ctx.edit('drawing', (project) => paint(project, marginCell))).toEqual({ kind: 'unchanged' })

      const withMarginBead: Project = withFields(base, { beads: beadsOfLayer(paint(base, marginCell), 'canvas') })
      const erasing = editHarness(withMarginBead)
      expect(erasing.edit('drawing', (project) => paint(project, marginCell, null))).toEqual({ kind: 'applied' })
      expect(colorAt(beadsOfLayer(erasing.project, 'canvas'), marginCell.row, marginCell.column)).toBeNull()
    })
  })

  describe('a frame change', () => {
    it('applies it once, resets the session once, and Undo restores the Frame', () => {
      const ctx = editHarness(base)
      const outcome = ctx.edit('frame', (project) => changeFrame(project, { set: { ...frame, rows: frame.rows + 1 } }))

      expect(outcome).toEqual({ kind: 'applied' })
      expect(frameOf(ctx.project)).toMatchObject({ rows: frame.rows + 1, columns: frame.columns })
      expect(ctx.resetAfterFrameChange).toHaveBeenCalledTimes(1)

      ctx.history.onUndo()
      expect(sheetOf(ctx.project)).toEqual(frame)
    })

    it('hands back the refusal and records nothing', () => {
      const ctx = editHarness(moveToRow(base, 1))
      expect(ctx.edit('frame', (project) => changeFrame(project, { technique: 'peyote' }))).toEqual({ kind: 'refused', reason: 'locked' })
      expect(ctx.history.canUndo.value).toBe(false)
      expect(ctx.resetAfterFrameChange).not.toHaveBeenCalled()
    })

    it('Remove Frame with passes done is one Undo step that brings back the Frame and the passes (ticket 426)', () => {
      const woven = moveToRow(base, 2)
      const ctx = editHarness(woven)
      expect(ctx.edit('frame', (project) => changeFrame(project, { remove: true }))).toEqual({ kind: 'applied' })
      expect(frameOf(ctx.project)).toBeUndefined()
      expect(rowProgressOn(ctx.project)).toBe(false)
      expect(rowProgressOf(ctx.project)).toMatchObject({ currentRow: 0 })

      ctx.history.onUndo()
      expect(sheetOf(ctx.project)).toEqual(sheetOf(woven))
      expect(rowProgressOf(ctx.project)).toEqual(rowProgressOf(woven))
      expect(ctx.history.canUndo.value).toBe(false)
    })

    it('says unchanged when the Frame already is what was asked', () => {
      const ctx = editHarness(base)
      expect(ctx.edit('frame', (project) => changeFrame(project, { set: frame }))).toEqual({ kind: 'unchanged' })
      expect(ctx.resetAfterFrameChange).not.toHaveBeenCalled()
    })
  })

  describe('a held frame change (ticket 0640)', () => {
    const grow = (by: number) => (project: Project) => changeFrame(project, { set: { ...frame, rows: frame.rows + by } })

    it('lands at once each time, and is one Undo step once settled', () => {
      const ctx = editHarness(base)
      expect(ctx.editing.hold(grow(1))).toEqual({ kind: 'applied' })
      expect(ctx.editing.hold(grow(2))).toEqual({ kind: 'applied' })
      expect(frameOf(ctx.project)).toMatchObject({ rows: frame.rows + 2 })
      expect(ctx.replaceProject).toHaveBeenCalledTimes(2)
      expect(ctx.resetAfterFrameChange).toHaveBeenCalledTimes(2)
      expect(ctx.history.canUndo.value).toBe(false)

      ctx.editing.settle()
      ctx.history.onUndo()
      expect(sheetOf(ctx.project)).toEqual(frame)
      expect(ctx.history.canUndo.value).toBe(false)
    })

    it('is settled first by another edit, a stroke, Undo and Redo, so the steps stay in order', () => {
      const ctx = editHarness(base)
      ctx.editing.hold(grow(1))
      ctx.edit('drawing', (project) => paint(project, inside(0, 0)))
      ctx.history.onUndo()
      expect(beadColorAt(ctx.project, inside(0, 0).row, inside(0, 0).column)).toBeNull()
      expect(frameOf(ctx.project)).toMatchObject({ rows: frame.rows + 1 })
      ctx.history.onUndo()
      expect(sheetOf(ctx.project)).toEqual(frame)

      ctx.editing.hold(grow(1))
      ctx.editing.beginStroke()
      ctx.editing.endStroke()
      ctx.history.onUndo()
      expect(sheetOf(ctx.project)).toEqual(frame)

      ctx.history.onRedo()
      ctx.editing.hold(grow(2))
      ctx.history.onUndo()
      expect(frameOf(ctx.project)).toMatchObject({ rows: frame.rows + 1 })
    })

    it('is no Undo step when it came back to where it began, or its Project is no longer open', () => {
      const ctx = editHarness(base)
      ctx.editing.hold(grow(1))
      ctx.editing.hold(grow(0))
      ctx.editing.settle()
      expect(ctx.history.canUndo.value).toBe(false)

      ctx.editing.hold(grow(1))
      ctx.replaceProject(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }))
      ctx.editing.settle()
      expect(ctx.history.canUndo.value).toBe(false)
    })

    it('hands back a refusal and holds nothing', () => {
      const ctx = editHarness(moveToRow(base, 1))
      expect(ctx.editing.hold(grow(1))).toEqual({ kind: 'refused', reason: 'locked' })
      ctx.editing.settle()
      expect(ctx.history.canUndo.value).toBe(false)
    })
  })

  describe('an exempt edit', () => {
    it('Delete all clears finished rows too, as one Undo step', () => {
      const painted = paint(moveToRow(base, 1), inside(1, 0))
      const woven: Project = withFields(painted, { frame: { ...frameOf(painted)!, beads: { ...frameOf(painted)!.beads, ...frameOf(paint(base, inside(0, 0)))!.beads } } })
      const ctx = editHarness(woven)
      expect(ctx.edit('exempt', deleteAll)).toEqual({ kind: 'applied' })
      expect(frameOf(ctx.project)!.beads).toEqual({})
      expect(rowProgressOf(ctx.project)).toMatchObject({ currentRow: 0 })

      ctx.history.onUndo()
      expect(frameOf(ctx.project)!.beads).toEqual(frameOf(woven)!.beads)
      expect(rowProgressOf(ctx.project)).toEqual(rowProgressOf(woven))
    })

    it('Replace Bead swaps only the Bead, and Undo swaps it back', () => {
      const other = BEAD_CATALOG.find((bead) => bead.id !== canvasOf(base).beadId)!
      const ctx = editHarness(base)
      ctx.edit('exempt', (project) => replaceBead(project, other))
      expect(canvasOf(ctx.project).beadId).toBe(other.id)

      ctx.history.onUndo()
      expect(canvasOf(ctx.project).beadId).toBe(canvasOf(base).beadId)
    })
  })

  describe('a cancelled stroke', () => {
    it('puts the baseline back with no Undo step, and keeps what Redo held', () => {
      const ctx = editHarness(base)
      ctx.edit('drawing', (project) => paint(project, inside(1, 1)))
      ctx.history.onUndo()
      expect(ctx.history.canRedo.value).toBe(true)

      ctx.editing.beginStroke()
      for (const column of [0, 1, 2]) {
        ctx.editing.strokeStep((project) => paint(project, inside(0, column)))
      }
      ctx.editing.cancelStroke()

      expect(frameOf(ctx.project)!.beads).toEqual(frameOf(base)!.beads)
      expect(ctx.history.canUndo.value).toBe(false)
      expect(ctx.history.canRedo.value).toBe(true)
      expect(ctx.flushPendingSave).toHaveBeenCalled()
    })

    it('is a no-op when no stroke is running, or when the stroke changed nothing', () => {
      const ctx = editHarness(base)
      ctx.editing.cancelStroke()
      ctx.editing.beginStroke()
      ctx.editing.cancelStroke()

      expect(ctx.replaceProject).not.toHaveBeenCalled()
      expect(ctx.history.canUndo.value).toBe(false)
    })

    it('leaves nothing for endStroke to record', () => {
      const ctx = editHarness(base)
      ctx.editing.beginStroke()
      ctx.editing.strokeStep((project) => paint(project, inside(0, 0)))
      ctx.editing.cancelStroke()
      ctx.editing.endStroke()

      expect(ctx.history.canUndo.value).toBe(false)
    })
  })

  describe('a stroke', () => {
    it('is one Undo step and one save however many cells it paints', () => {
      const ctx = editHarness(base)
      ctx.editing.beginStroke()
      for (const column of [0, 1, 2]) {
        ctx.editing.strokeStep((project) => paint(project, inside(0, column)))
      }
      expect(ctx.replaceProject).toHaveBeenCalledTimes(3)
      expect(ctx.replaceProject).toHaveBeenCalledWith(expect.anything(), { deferSave: true })
      expect(ctx.history.canUndo.value).toBe(false)
      expect(ctx.flushPendingSave).not.toHaveBeenCalled()

      ctx.editing.endStroke()
      expect(ctx.flushPendingSave).toHaveBeenCalledTimes(1)
      ctx.history.onUndo()
      expect(frameOf(ctx.project)!.beads).toEqual(frameOf(base)!.beads)
      expect(ctx.history.canUndo.value).toBe(false)
    })

    it('across finished rows leaves them alone', () => {
      const ctx = editHarness(moveToRow(base, 1))
      ctx.editing.beginStroke()
      ctx.editing.strokeStep((project) => paint(project, inside(0, 0)))
      ctx.editing.strokeStep((project) => paint(project, inside(1, 0)))
      ctx.editing.endStroke()

      expect(beadColorAt(ctx.project, inside(0, 0).row, inside(0, 0).column)).toBeNull()
      expect(beadColorAt(ctx.project, inside(1, 0).row, inside(1, 0).column)).toBe('#ff0000')
    })

    it('that changed nothing is no Undo step, but still flushes', () => {
      const ctx = editHarness(base)
      ctx.editing.beginStroke()
      ctx.editing.strokeStep((project) => paint(project, marginCell))
      ctx.editing.endStroke()

      expect(ctx.history.canUndo.value).toBe(false)
      expect(ctx.flushPendingSave).toHaveBeenCalledTimes(1)
    })

    it('ending with none running only flushes', () => {
      const ctx = editHarness(base)
      ctx.editing.endStroke()
      expect(ctx.history.canUndo.value).toBe(false)
      expect(ctx.flushPendingSave).toHaveBeenCalledTimes(1)
    })
  })

  it('does nothing with no Project open', () => {
    const ctx = editHarness(undefined)
    expect(ctx.edit('drawing', (project) => project)).toEqual({ kind: 'unchanged' })
    ctx.editing.beginStroke()
    ctx.editing.strokeStep((project) => project)
    ctx.history.onUndo()
    expect(ctx.replaceProject).not.toHaveBeenCalled()
  })

  it('Undo replays history without the lock: it can restore a finished row', () => {
    const ctx = editHarness(base)
    ctx.edit('drawing', (project) => paint(project, inside(0, 0)))
    ctx.replaceProject(moveToRow(ctx.project, 2))

    ctx.history.onUndo()
    expect(frameOf(ctx.project)!.beads).toEqual(frameOf(base)!.beads)
  })
})

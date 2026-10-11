import { describe, expect, it } from 'vitest'
import { changeFrame } from '../../domain/changeFrame'
import { colorAt } from '../../domain/canvas'
import { deleteAll, createProject, moveToRow, paintCells, replaceBead, setRowProgressEnabled, type Project } from '../../domain/project'
import { BEAD_CATALOG } from '../../domain/beads'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { editHarness } from '../../testUtils/editHarness'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })
const frame = base.frame!
const inside = (row: number, column: number) => ({ row: frame.row + row, column: frame.column + column })
const marginCell = { row: frame.row - 1, column: frame.column }

function paint(project: Project, at: { row: number; column: number }, color: string | null = '#ff0000') {
  return paintCells(project, [at], color, NO_MIRROR_AXES, false)
}

describe('useEdit', () => {
  describe('a drawing edit', () => {
    it('lands on the Project, and Undo brings it back', () => {
      const ctx = editHarness(base)
      const outcome = ctx.edit('drawing', (project) => paint(project, inside(0, 0)))

      expect(outcome).toEqual({ kind: 'applied', moved: 0 })
      expect(colorAt(ctx.project.beads, inside(0, 0).row, inside(0, 0).column)).toBe('#ff0000')

      ctx.history.onUndo()
      expect(ctx.project.beads).toEqual(base.beads)
      ctx.history.onRedo()
      expect(colorAt(ctx.project.beads, inside(0, 0).row, inside(0, 0).column)).toBe('#ff0000')
    })

    it('is no Undo step when it leaves no effect', () => {
      const ctx = editHarness(base)
      expect(ctx.edit('drawing', (project) => project)).toEqual({ kind: 'unchanged' })
      expect(ctx.history.canUndo.value).toBe(false)
      expect(ctx.replaceProject).not.toHaveBeenCalled()
    })

    it('leaves finished rows alone and keeps the rest of the edit', () => {
      const woven = moveToRow(setRowProgressEnabled(base, true), 1)
      const ctx = editHarness(woven)
      ctx.edit('drawing', (project) => paintCells(project, [inside(0, 0), inside(1, 0)], '#ff0000', NO_MIRROR_AXES, false))

      expect(colorAt(ctx.project.beads, inside(0, 0).row, inside(0, 0).column)).toBeNull()
      expect(colorAt(ctx.project.beads, inside(1, 0).row, inside(1, 0).column)).toBe('#ff0000')
    })

    it('is refused silently when it only touched finished rows', () => {
      const ctx = editHarness(moveToRow(setRowProgressEnabled(base, true), 1))
      expect(ctx.edit('drawing', (project) => paint(project, inside(0, 0)))).toEqual({ kind: 'unchanged' })
      expect(ctx.history.canUndo.value).toBe(false)
    })

    it('drops what lands in the margin, but erasing there still works', () => {
      const ctx = editHarness(base)
      expect(ctx.edit('drawing', (project) => paint(project, marginCell))).toEqual({ kind: 'unchanged' })

      const withMarginBead: Project = { ...base, beads: paint(base, marginCell).beads }
      const erasing = editHarness(withMarginBead)
      expect(erasing.edit('drawing', (project) => paint(project, marginCell, null))).toEqual({ kind: 'applied', moved: 0 })
      expect(colorAt(erasing.project.beads, marginCell.row, marginCell.column)).toBeNull()
    })
  })

  describe('a frame change', () => {
    it('applies it once, resets the session once, and Undo restores the Frame and Mirror’s counts', () => {
      const counts = { columns: 1, rows: 0 }
      const ctx = editHarness(base, { mirrorAxisCounts: counts })
      const outcome = ctx.edit('frame', (project) => changeFrame(project, { rotate: true }))

      expect(outcome).toEqual({ kind: 'applied', moved: 0 })
      expect(ctx.project.frame).toMatchObject({ rows: frame.columns, columns: frame.rows })
      expect(ctx.resetAfterFrameChange).toHaveBeenCalledTimes(1)
      expect(ctx.mirrorAxisCounts.current).toEqual(NO_MIRROR_AXES)

      ctx.history.onUndo()
      expect(ctx.project.frame).toEqual(frame)
      expect(ctx.mirrorAxisCounts.current).toEqual(counts)
    })

    it('hands back the refusal and records nothing', () => {
      const ctx = editHarness(setRowProgressEnabled(base, true))
      expect(ctx.edit('frame', (project) => changeFrame(project, { rotate: true }))).toEqual({ kind: 'refused', reason: 'locked' })
      expect(ctx.history.canUndo.value).toBe(false)
      expect(ctx.resetAfterFrameChange).not.toHaveBeenCalled()
    })

    it('says unchanged when the Frame already is what was asked', () => {
      const ctx = editHarness(base)
      expect(ctx.edit('frame', (project) => changeFrame(project, { set: frame }))).toEqual({ kind: 'unchanged' })
      expect(ctx.resetAfterFrameChange).not.toHaveBeenCalled()
    })
  })

  describe('an exempt edit', () => {
    it('Delete all clears finished rows too, as one Undo step', () => {
      const painted = paint(moveToRow(setRowProgressEnabled(base, true), 1), inside(1, 0))
      const woven: Project = { ...painted, beads: { ...painted.beads, ...paint(base, inside(0, 0)).beads } }
      const ctx = editHarness(woven)
      expect(ctx.edit('exempt', deleteAll)).toEqual({ kind: 'applied', moved: 0 })
      expect(ctx.project.beads).toEqual({})
      expect(ctx.project.rowProgress.enabled).toBe(false)

      ctx.history.onUndo()
      expect(ctx.project.beads).toEqual(woven.beads)
      expect(ctx.project.rowProgress).toEqual(woven.rowProgress)
    })

    it('Replace Bead swaps only the Bead, and Undo swaps it back', () => {
      const other = BEAD_CATALOG.find((bead) => bead.id !== base.beadId)!
      const ctx = editHarness(base)
      ctx.edit('exempt', (project) => replaceBead(project, other))
      expect(ctx.project.beadId).toBe(other.id)

      ctx.history.onUndo()
      expect(ctx.project.beadId).toBe(base.beadId)
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

      expect(ctx.project.beads).toEqual(base.beads)
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
      expect(ctx.project.beads).toEqual(base.beads)
      expect(ctx.history.canUndo.value).toBe(false)
    })

    it('across finished rows leaves them alone', () => {
      const ctx = editHarness(moveToRow(setRowProgressEnabled(base, true), 1))
      ctx.editing.beginStroke()
      ctx.editing.strokeStep((project) => paint(project, inside(0, 0)))
      ctx.editing.strokeStep((project) => paint(project, inside(1, 0)))
      ctx.editing.endStroke()

      expect(colorAt(ctx.project.beads, inside(0, 0).row, inside(0, 0).column)).toBeNull()
      expect(colorAt(ctx.project.beads, inside(1, 0).row, inside(1, 0).column)).toBe('#ff0000')
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
    ctx.replaceProject(moveToRow(setRowProgressEnabled(ctx.project, true), 2))

    ctx.history.onUndo()
    expect(ctx.project.beads).toEqual(base.beads)
  })
})

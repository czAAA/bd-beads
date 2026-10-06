// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { colorAt, forEachBead, withColors, type Frame } from './canvas'
import { changeFrame, type FrameChange } from './changeFrame'
import { inMargin } from './margin'
import { createProject, type Project } from './project'

const frame: Frame = { row: 10, column: 10, rows: 6, columns: 4 }

function framed(overrides: Partial<Project> = {}): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  return { ...base, frame, ...overrides }
}

const woven = (direction: 'rows' | 'columns', currentRow = 5, currentColumn = 3, enabled = true) => ({ enabled, direction, currentRow, currentColumn })

const beadCount = (project: Project) => {
  let count = 0
  forEachBead(project.beads, () => (count += 1))
  return count
}

describe('changeFrame', () => {
  describe('refusals', () => {
    const changes: [string, FrameChange][] = [
      ['set', { set: { row: 0, column: 0, rows: 2, columns: 2 } }],
      ['remove', { remove: true }],
      ['rotate', { rotate: true }],
      ['removeLine', { removeLine: { axis: 'row', index: 0 } }],
    ]
    it.each(changes)('refuses %s while Row progress is on', (_name, change) => {
      const project = framed({ rowProgress: woven('rows') })
      expect(changeFrame(project, change)).toEqual({ kind: 'refused', reason: 'locked' })
    })

    it('needs a Frame to rotate or remove a line from', () => {
      const none = framed()
      delete none.frame
      expect(changeFrame(none, { rotate: true })).toEqual({ kind: 'refused', reason: 'no-frame' })
      expect(changeFrame(none, { removeLine: { axis: 'row', index: 0 } })).toEqual({ kind: 'refused', reason: 'no-frame' })
    })

    it('refuses a line the Frame does not have, and the only one it has', () => {
      expect(changeFrame(framed(), { removeLine: { axis: 'row', index: 6 } })).toEqual({ kind: 'refused', reason: 'no-line' })
      expect(changeFrame(framed(), { removeLine: { axis: 'column', index: -1 } })).toEqual({ kind: 'refused', reason: 'no-line' })
      const single = framed({ frame: { ...frame, rows: 1 } })
      expect(changeFrame(single, { removeLine: { axis: 'row', index: 0 } })).toEqual({ kind: 'refused', reason: 'only-line' })
    })
  })

  describe('no change', () => {
    it('hands back the same Project for the same Frame, or for no Frame removed', () => {
      const project = framed()
      expect(changeFrame(project, { set: { ...frame } })).toEqual({ kind: 'unchanged', project })
      const none = framed()
      delete none.frame
      const result = changeFrame(none, { remove: true })
      expect(result).toEqual({ kind: 'unchanged', project: none })
      expect(result.kind === 'unchanged' && result.project).toBe(none)
    })
  })

  describe('Row progress pointers', () => {
    const cases: ['rows' | 'columns', FrameChange][] = [
      ['rows', { set: { row: 0, column: 0, rows: 2, columns: 2 } }],
      ['columns', { set: { row: 0, column: 0, rows: 2, columns: 2 } }],
      ['rows', { removeLine: { axis: 'row', index: 0 } }],
      ['columns', { removeLine: { axis: 'column', index: 0 } }],
      ['rows', { rotate: true }],
      ['columns', { rotate: true }],
    ]
    it.each(cases)('keeps both pointers inside the new Frame (%s, %j)', (direction, change) => {
      // Row progress off, so the change is allowed; the pointers are what it had saved.
      const wide = framed({ frame: { row: 10, column: 10, rows: 50, columns: 30 }, rowProgress: woven(direction, 40, 25, false) })
      const result = changeFrame(wide, change)
      if (result.kind !== 'changed') throw new Error('expected a change')
      const next = result.project.frame!
      expect(result.project.rowProgress.currentRow).toBeLessThan(next.rows)
      expect(result.project.rowProgress.currentColumn).toBeLessThan(next.columns)
    })
  })

  describe('margin', () => {
    it('moves a Piece the new Frame reaches clear, whole, and counts Pieces', () => {
      const open = framed()
      delete open.frame
      const beads = withColors(open.beads, [
        { row: 12, column: 8, color: '#00ff00' },
        { row: 8, column: 10, color: '#ff0000' },
        { row: 8, column: 11, color: '#ff0000' },
        { row: 40, column: 40, color: '#0000ff' },
      ])
      const result = changeFrame({ ...open, beads }, { set: frame })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.moved).toBe(2)
      expect(beadCount(result.project)).toBe(4)
      forEachBead(result.project.beads, (row, column) => {
        expect(inMargin(frame, { row, column })).toBe(false)
      })
      expect(colorAt(result.project.beads, 40, 40)).toBe('#0000ff')
    })

    it('reports no Pieces moved when the margin was already clear', () => {
      const result = changeFrame(framed(), { set: { ...frame, rows: 7 } })
      expect(result).toMatchObject({ kind: 'changed', moved: 0 })
    })

    it('counts the Pieces a Rotate moves', () => {
      const square = framed({ frame: { row: 0, column: 0, rows: 4, columns: 4 } })
      const beads = withColors(square.beads, [{ row: 0, column: 0, color: '#00ff00' }, { row: 5, column: 1, color: '#ff0000' }])
      const result = changeFrame({ ...square, beads }, { rotate: true })
      expect(result).toMatchObject({ kind: 'changed', moved: 1 })
    })
  })

  describe('variants', () => {
    it('removes the Frame, margin and all', () => {
      const result = changeFrame(framed(), { remove: true })
      expect(result.kind === 'changed' && result.project.frame).toBeUndefined()
    })

    it('removes a line, closing the gap', () => {
      const project = framed({ beads: withColors({}, [{ row: 10, column: 10, color: '#111111' }, { row: 11, column: 10, color: '#222222' }]) })
      const result = changeFrame(project, { removeLine: { axis: 'row', index: 0 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame).toMatchObject({ rows: 5, columns: 4 })
      expect(colorAt(result.project.beads, 10, 10)).toBe('#222222')
    })
  })
})

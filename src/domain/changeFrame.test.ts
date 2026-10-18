// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { colorAt, withColors, type Frame } from './canvas'
import { changeFrame, frameChangeDiscardsProgress, type FrameChange } from './changeFrame'
import { inMargin } from './margin'
import { createProject, rowProgressOn, withFrame, type Project } from './project'

const frame: Frame = { row: 10, column: 10, rows: 6, columns: 4 }

function framed(overrides: Partial<Project> = {}): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  return { ...base, frame, ...overrides }
}

const woven = (direction: 'rows' | 'columns', currentRow = 5, currentColumn = 3) => ({ direction, currentRow, currentColumn })

describe('changeFrame', () => {
  describe('refusals', () => {
    const changes: [string, FrameChange][] = [
      ['set', { set: { row: 0, column: 0, rows: 2, columns: 2 } }],
      ['removeLine', { removeLine: { axis: 'row', index: 0 } }],
      ['technique', { technique: 'peyote' }],
    ]
    it.each(changes)('refuses %s once Row progress is on and a pass is done (ticket 411)', (_name, change) => {
      const project = framed({ rowProgress: woven('rows') })
      expect(changeFrame(project, change)).toEqual({ kind: 'refused', reason: 'locked' })
    })

    it.each(changes)('allows %s while Row progress is on but no pass is done (ticket 411)', (_name, change) => {
      const project = framed({ rowProgress: woven('rows', 0, 0) })
      expect(changeFrame(project, change).kind).not.toBe('refused')
    })

    it('lets Remove Frame through with passes done, clearing them with the Frame (ticket 426)', () => {
      const project = framed({ rowProgress: woven('columns', 5, 3) })
      const result = changeFrame(project, { remove: true })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame).toBeUndefined()
      expect(result.project.rowProgress).toEqual({ direction: 'columns', currentRow: 0, currentColumn: 0 })
    })

    it('needs a Frame to remove a line from', () => {
      const none = framed()
      delete none.frame
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

  describe('Row progress follows the Frame (ticket 426)', () => {
    const open = (): Project => {
      const project = framed()
      delete project.frame
      return project
    }

    it('is on at the first Frame set, the pointers at the first pass', () => {
      const result = changeFrame({ ...open(), rowProgress: { ...woven('columns', 3, 2) } }, { set: frame })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.rowProgress).toMatchObject({ currentRow: 3, currentColumn: 2 })
      expect(rowProgressOn(result.project)).toBe(true)
    })

    it('stays on for a Frame moved or resized, and comes on again when a removed Frame is set anew', () => {
      const turnedOn = changeFrame(open(), { set: frame })
      if (turnedOn.kind !== 'changed') throw new Error('expected a change')
      const moved = changeFrame(turnedOn.project, { set: { ...frame, rows: 8 } })
      if (moved.kind !== 'changed') throw new Error('expected a change')
      expect(rowProgressOn(moved.project)).toBe(true)
      const removed = changeFrame(moved.project, { remove: true })
      if (removed.kind !== 'changed') throw new Error('expected a change')
      expect(rowProgressOn(removed.project)).toBe(false)
      const reset = changeFrame(removed.project, { set: frame })
      if (reset.kind !== 'changed') throw new Error('expected a change')
      expect(rowProgressOn(reset.project)).toBe(true)
      expect(reset.project.rowProgress).toMatchObject({ currentRow: 0, currentColumn: 0 })
    })
  })

  describe('frameChangeDiscardsProgress (ticket 434)', () => {
    const changes: FrameChange[] = [{ set: frame }, { removeLine: { axis: 'row', index: 0 } }, { technique: 'peyote' }]

    it('is true only for Remove Frame once a pass is done', () => {
      expect(frameChangeDiscardsProgress(framed({ rowProgress: woven('rows', 1, 0) }), { remove: true })).toBe(true)
      expect(frameChangeDiscardsProgress(framed({ rowProgress: woven('columns', 0, 2) }), { remove: true })).toBe(true)
    })

    it('is false for Remove Frame while no pass is done, since nothing is thrown away', () => {
      expect(frameChangeDiscardsProgress(framed({ rowProgress: woven('rows', 0, 0) }), { remove: true })).toBe(false)
      const { frame: _frame, ...unframed } = framed()
      expect(frameChangeDiscardsProgress(unframed as Project, { remove: true })).toBe(false)
    })

    it.each(changes)('is false for every other change, passes done or not (%j)', (change) => {
      expect(frameChangeDiscardsProgress(framed({ rowProgress: woven('rows', 3, 0) }), change)).toBe(false)
    })
  })

  describe('Row progress pointers', () => {
    it.each(['rows', 'columns'] as const)('keeps both pointers inside a smaller Frame (%s)', (direction) => {
      const wide = framed({ frame: { row: 10, column: 10, rows: 50, columns: 30 }, rowProgress: woven(direction, 40, 25) })
      const next = withFrame(wide, { row: 0, column: 0, rows: 2, columns: 2 })
      // One past the last pass means every pass is done (ticket 411).
      expect(next.rowProgress.currentRow).toBeLessThanOrEqual(2)
      expect(next.rowProgress.currentColumn).toBeLessThanOrEqual(2)
    })
  })

  describe('margin', () => {
    it('leaves beads the new Frame reaches where they are, covered by the margin', () => {
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
      expect(result.project.beads).toEqual(beads)
      expect(inMargin(frame, { row: 8, column: 10 })).toBe(true)
    })
  })

  describe('technique', () => {
    it('changes only the Technique: grid, beads and Frame keep their rows and columns', () => {
      const project = framed({ beads: withColors({}, [{ row: 11, column: 11, color: '#111111' }]) })
      const result = changeFrame(project, { technique: 'peyote' })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.technique).toBe('peyote')
      expect(result.project.frame).toEqual(frame)
      expect(result.project.beads).toEqual(project.beads)
    })

    it('is no change to the Technique it already has', () => {
      const project = framed()
      const result = changeFrame(project, { technique: 'loom' })
      expect(result.kind === 'unchanged' && result.project).toBe(project)
    })

    it('works with no Frame', () => {
      const none = framed()
      delete none.frame
      const result = changeFrame(none, { technique: 'brick' })
      expect(result.kind === 'changed' && result.project.technique).toBe('brick')
    })

    it('keeps an offset Technique\'s Frame on an even row, taking in the row above', () => {
      const odd = framed({ frame: { row: 11, column: 10, rows: 6, columns: 4 } })
      const result = changeFrame(odd, { technique: 'peyote' })
      expect(result.kind === 'changed' && result.project.frame).toEqual({ row: 10, column: 10, rows: 7, columns: 4 })
    })
  })

  describe('Brick block (ticket 477)', () => {
    const brick = () => framed({ technique: 'brick' })

    it('changes only the Brick block: Frame and beads keep their rows and columns', () => {
      const project = framed({ technique: 'brick', frame: { row: 12, column: 3, rows: 6, columns: 4 }, beads: withColors({}, [{ row: 13, column: 4, color: '#111111' }]) })
      const result = changeFrame(project, { brickBlock: 3 })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.brickBlock).toBe(3)
      expect(result.project.frame).toEqual({ row: 12, column: 3, rows: 6, columns: 4 })
      expect(result.project.beads).toEqual(project.beads)
    })

    it('takes in the rows above a Frame that no longer starts on a multiple of 2N', () => {
      const project = framed({ technique: 'brick', frame: { row: 10, column: 3, rows: 6, columns: 4 } })
      const result = changeFrame(project, { brickBlock: 3 })
      expect(result.kind === 'changed' && result.project.frame).toEqual({ row: 6, column: 3, rows: 10, columns: 4 })
    })

    it('is no change to the Brick block it already has, and 1 when none is stored', () => {
      const project = brick()
      expect(changeFrame(project, { brickBlock: 1 })).toEqual({ kind: 'unchanged', project })
      const three = { ...project, brickBlock: 3 }
      expect(changeFrame(three, { brickBlock: 3 })).toEqual({ kind: 'unchanged', project: three })
    })

    it('keeps the value when the Technique is switched away and back', () => {
      const three = { ...brick(), brickBlock: 3 }
      const peyote = changeFrame(three, { technique: 'peyote' })
      if (peyote.kind !== 'changed') throw new Error('expected a change')
      const back = changeFrame(peyote.project, { technique: 'brick' })
      expect(back.kind === 'changed' && back.project.brickBlock).toBe(3)
    })

    it('holds a value from 1 to 20', () => {
      const high = changeFrame(brick(), { brickBlock: 99 })
      expect(high.kind === 'changed' && high.project.brickBlock).toBe(20)
    })

    it('is refused once a pass is done (Row progress)', () => {
      const started = framed({ technique: 'brick', rowProgress: woven('rows', 2, 0) })
      expect(changeFrame(started, { brickBlock: 2 })).toEqual({ kind: 'refused', reason: 'locked' })
    })
  })

  describe('technique and the margin', () => {
    it('takes a bead in the row above an odd-row Frame into the Frame rather than moving it', () => {
      const odd = framed({ frame: { row: 11, column: 10, rows: 6, columns: 4 }, beads: withColors({}, [{ row: 10, column: 11, color: '#111111' }]) })
      const result = changeFrame(odd, { technique: 'peyote' })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(colorAt(result.project.beads, 10, 11)).toBe('#111111')
    })

    it('leaves every bead where it was when the Frame stays', () => {
      const beads = withColors({}, [{ row: 10, column: 10, color: '#111111' }, { row: 15, column: 13, color: '#222222' }])
      const result = changeFrame(framed({ beads }), { technique: 'brick' })
      expect(result.kind === 'changed' && result.project.beads).toEqual(beads)
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

  describe('move (ticket 452)', () => {
    const beads = withColors({}, [
      { row: 10, column: 10, color: '#111111' },
      { row: 4, column: 4, color: '#999999' },
      { row: 10, column: 12, color: '#222222' },
    ])

    it('carries the Frame\'s beads, empties what it left and overwrites the destination', () => {
      const project = framed({ beads: withColors(beads, [{ row: 10, column: 13, color: '#333333' }]) })
      const result = changeFrame(project, { move: { rows: 0, columns: 3 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame).toMatchObject({ row: 10, column: 13 })
      expect(colorAt(result.project.beads, 10, 13)).toBe('#111111')
      expect(colorAt(result.project.beads, 10, 10)).toBeNull()
      expect(colorAt(result.project.beads, 10, 15)).toBe('#222222')
      expect(colorAt(result.project.beads, 4, 4)).toBe('#999999')
    })

    it('is allowed after Row progress has started, and the pointer stays with the Frame', () => {
      const project = framed({ beads, rowProgress: woven('rows') })
      const result = changeFrame(project, { move: { rows: 2, columns: 0 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.rowProgress).toMatchObject({ currentRow: 5, currentColumn: 3 })
    })

    it('moves by pairs of rows on peyote', () => {
      const project = framed({ technique: 'peyote' })
      const result = changeFrame(project, { move: { rows: 1, columns: 0 } })
      expect(result.kind === 'changed' && result.project.frame?.row).toBe(12)
    })

    it('is no change for no distance', () => {
      expect(changeFrame(framed(), { move: { rows: 0, columns: 0 } }).kind).toBe('unchanged')
    })

    describe('beads under the destination (ticket 476)', () => {
      const movedRight = (project: Project, columns: number) => {
        const result = changeFrame(project, { move: { rows: 0, columns } })
        if (result.kind !== 'changed') throw new Error('expected a change')
        return result.project
      }

      it('keeps them hidden under the Frame instead of clearing them, and does not count them', () => {
        const project = framed({ beads: withColors(beads, [{ row: 11, column: 16, color: '#333333' }]) })
        const moved = movedRight(project, 3)
        expect(colorAt(moved.beads, 11, 16)).toBeNull()
        expect(colorAt(moved.coveredBeads ?? {}, 11, 16)).toBe('#333333')
      })

      it('brings them back when the Frame moves off them', () => {
        const project = framed({ beads: withColors(beads, [{ row: 11, column: 16, color: '#333333' }]) })
        const back = movedRight(movedRight(project, 3), -3)
        expect(colorAt(back.beads, 11, 16)).toBe('#333333')
        expect(colorAt(back.beads, 10, 10)).toBe('#111111')
        expect(back.coveredBeads).toBeUndefined()
      })

      it('keeps what stays under the Frame covered while it slides over it', () => {
        const project = framed({ beads: withColors(beads, [{ row: 10, column: 14, color: '#444444' }]) })
        const moved = movedRight(movedRight(project, 2), 1)
        expect(colorAt(moved.coveredBeads ?? {}, 10, 14)).toBe('#444444')
        expect(colorAt(moved.beads, 10, 14)).toBeNull()
      })

      it('shows a covered bead again when Remove Frame takes the Frame away', () => {
        const project = framed({ beads: withColors(beads, [{ row: 11, column: 16, color: '#333333' }]) })
        const result = changeFrame(movedRight(project, 3), { remove: true })
        if (result.kind !== 'changed') throw new Error('expected a change')
        expect(colorAt(result.project.beads, 11, 16)).toBe('#333333')
        expect(result.project.coveredBeads).toBeUndefined()
      })
    })
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { colorAt, withColors, type Rect, type FrameSheet } from './canvas'
import { describeWeave } from './weave'
import { changeCanvasWeave, changeFrame, frameChangeDiscardsProgress, type FrameChange } from './changeFrame'
import { shownBeads } from './layers'
import { createProject } from './createProject'
import { rowProgressOn } from './rowProgress'
import { switchLoss } from './weaveSwitch'
import { frameWithEdgeStep, withFrame } from './frame'
import { frameWeave } from './layerWeave'
import type { Project } from './project'

const frame: Rect = { row: 10, column: 10, rows: 6, columns: 4 }

/** A Frame holding the beads given, counted from its own first row and column. */
const sheet = (rectangle: Rect, beads: FrameSheet['beads'] = {}): FrameSheet => ({ row: rectangle.row, column: rectangle.column, rows: rectangle.rows, columns: rectangle.columns, beads, technique: 'loom' })

function framed(overrides: Partial<Project> = {}): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  return { ...base, frame: sheet(frame), ...overrides }
}

const woven = (direction: 'rows' | 'columns', currentRow = 5, currentColumn = 3) => ({ direction, currentRow, currentColumn })

describe('changeFrame in Right-angle weave (ticket 482)', () => {
  const woven = () => ({ ...createProject({ technique: 'rightAngle', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } }) })

  it('switches the Frame to and from another Technique (ticket 507)', () => {
    expect(changeFrame(woven(), { technique: 'peyote' }).kind).toBe('changed')
    expect(changeFrame(framed(), { technique: 'rightAngle' }).kind).toBe('changed')
  })

  it('does not take out a single line, which is not a Unit', () => {
    expect(changeFrame(woven(), { removeLine: { axis: 'row', index: 0 } })).toEqual({ kind: 'refused', reason: 'fixed-weave' })
  })

  it('still moves, in whole Units', () => {
    const result = changeFrame(woven(), { move: { rows: 2, columns: 1 } })
    expect(result.kind === 'changed' && result.project.frame).toMatchObject({ row: 2, column: 1, rows: 5, columns: 4 })
  })
})

describe('changeFrame naming the Frame (ticket 555)', () => {
  it('sets the name, keeps the rest of the Frame, and an empty name clears it', () => {
    const named = changeFrame(framed(), { name: 'Moth wing' })
    if (named.kind !== 'changed') throw new Error('expected a change')
    expect(named.project.frame).toEqual({ ...sheet(frame), name: 'Moth wing' })
    const cleared = changeFrame(named.project, { name: '' })
    expect(cleared.kind === 'changed' && cleared.project.frame).toEqual(sheet(frame))
  })

  it('is no change for the name it already has, and refused with no Frame', () => {
    expect(changeFrame(framed(), { name: '' }).kind).toBe('unchanged')
    const { frame: _frame, ...open } = framed()
    expect(changeFrame(open, { name: 'Moth' })).toEqual({ kind: 'refused', reason: 'no-frame' })
  })

  it('still names a Frame once a pass is done', () => {
    expect(changeFrame(framed({ rowProgress: woven('rows') }), { name: 'Moth' }).kind).toBe('changed')
  })
})

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
      const single = framed({ frame: sheet({ ...frame, rows: 1 }) })
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
      const wide = framed({ frame: sheet({ row: 10, column: 10, rows: 50, columns: 30 }), rowProgress: woven(direction, 40, 25) })
      const next = withFrame(wide, { row: 0, column: 0, rows: 2, columns: 2 })
      // One past the last pass means every pass is done (ticket 411).
      expect(next.rowProgress.currentRow).toBeLessThanOrEqual(2)
      expect(next.rowProgress.currentColumn).toBeLessThanOrEqual(2)
    })
  })

  describe('beads against the Frame', () => {
    it('leaves beads next to the new Frame where they are on the Canvas', () => {
      const open = framed()
      delete open.frame
      const beads = withColors(open.beads, [
        { row: 12, column: 8, color: '#00ff00' },
        { row: 8, column: 10, color: '#ff0000' },
        { row: 8, column: 11, color: '#ff0000' },
        { row: 40, column: 40, color: '#0000ff' },
      ])
      const result = changeFrame({ ...open, beads }, { make: frame })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.beads).toEqual(beads)
    })
  })

  describe('technique (the Frame\'s own, ticket 492)', () => {
    it('changes only the Frame\'s Technique: its beads, the Canvas and its place keep their rows and columns', () => {
      const project = framed({ frame: sheet(frame, withColors({}, [{ row: 1, column: 1, color: '#111111' }])), beads: withColors({}, [{ row: 40, column: 1, color: '#222222' }]) })
      const result = changeFrame(project, { technique: 'peyote' })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame).toEqual({ ...project.frame, technique: 'peyote' })
      expect(result.project.technique).toBe('loom')
      expect(result.project.beads).toEqual(project.beads)
    })

    it('is no change to the Technique it already has', () => {
      const project = framed()
      const result = changeFrame(project, { technique: 'loom' })
      expect(result.kind === 'unchanged' && result.project).toBe(project)
    })

    it('needs a Frame', () => {
      const none = framed()
      delete none.frame
      expect(changeFrame(none, { technique: 'brick' })).toEqual({ kind: 'refused', reason: 'no-frame' })
    })

    it('leaves a Frame on an odd row where it is: its own row 0 is straight whatever the Canvas does', () => {
      const odd = framed({ frame: sheet({ row: 11, column: 10, rows: 6, columns: 4 }, withColors({}, [{ row: 0, column: 2, color: '#111111' }])) })
      const result = changeFrame(odd, { technique: 'peyote' })
      expect(result.kind === 'changed' && result.project.frame).toEqual({ ...odd.frame, technique: 'peyote' })
    })
  })

  describe('Brick block (ticket 477)', () => {
    const brick = () => framed({ frame: { ...sheet(frame), technique: 'brick' } })

    it('changes only the Frame\'s Brick block: its place and beads keep their rows and columns', () => {
      const project = framed({ frame: { ...sheet({ row: 12, column: 3, rows: 6, columns: 4 }, withColors({}, [{ row: 1, column: 1, color: '#111111' }])), technique: 'brick' } })
      const result = changeFrame(project, { techniqueSettings: { brickBlock: 3 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame).toEqual({ ...project.frame, techniqueSettings: { brickBlock: 3 } })
      expect(result.project.techniqueSettings).toBeUndefined()
    })

    it('is no change to the Brick block it already has, and 1 when none is stored', () => {
      const project = brick()
      expect(changeFrame(project, { techniqueSettings: { brickBlock: 1 } })).toEqual({ kind: 'unchanged', project })
      const three = { ...project, frame: { ...project.frame!, techniqueSettings: { brickBlock: 3 } } }
      expect(changeFrame(three, { techniqueSettings: { brickBlock: 3 } })).toEqual({ kind: 'unchanged', project: three })
    })

    it('keeps the value when the Technique is switched away and back', () => {
      const three = { ...brick(), frame: { ...brick().frame!, techniqueSettings: { brickBlock: 3 } } }
      const peyote = changeFrame(three, { technique: 'peyote' })
      if (peyote.kind !== 'changed') throw new Error('expected a change')
      const back = changeFrame(peyote.project, { technique: 'brick' })
      expect(back.kind === 'changed' && back.project.frame?.techniqueSettings?.brickBlock).toBe(3)
    })

    it('holds a value from 1 to 20', () => {
      const high = changeFrame(brick(), { techniqueSettings: { brickBlock: 99 } })
      expect(high.kind === 'changed' && high.project.frame?.techniqueSettings?.brickBlock).toBe(20)
    })

    it('is refused once a pass is done (Row progress)', () => {
      const started = framed({ frame: { ...sheet(frame), technique: 'brick' }, rowProgress: woven('rows', 2, 0) })
      expect(changeFrame(started, { techniqueSettings: { brickBlock: 2 } })).toEqual({ kind: 'refused', reason: 'locked' })
    })
  })

  describe('the Canvas\'s Technique (ticket 492)', () => {
    it('switches at any time, even with a pass done, and leaves the Frame woven as it was', () => {
      const started = framed({ rowProgress: woven('rows', 2, 0), beads: withColors({}, [{ row: 40, column: 1, color: '#222222' }]) })
      const result = changeCanvasWeave(started, { technique: 'peyote' })
      expect(result.technique).toBe('peyote')
      expect(result.frame?.technique).toBe('loom')
      expect(result.beads).toEqual(started.beads)
    })

    it('is the same Project for the Technique it has', () => {
      const project = framed()
      expect(changeCanvasWeave(project, { technique: 'loom' })).toBe(project)
    })

    const TECHNIQUES_ALL = ['loom', 'peyote', 'brick', 'rightAngle', 'netting'] as const

    it('switches between every ordered pair of Techniques, keeping the beads that have a position and dropping the rest (ticket 507)', () => {
      for (const from of TECHNIQUES_ALL) {
        for (const to of TECHNIQUES_ALL) {
          if (from === to) continue
          const start = framed({ technique: from, ...(from === 'netting' ? { techniqueSettings: { netSize: 3 } } : {}), beads: { 0: { 0: '#111111', 1: '#222222' }, 3: { 2: '#333333' } } })
          const next = changeCanvasWeave(start, { technique: to, techniqueSettings: { netSize: 3 } })
          const target = describeWeave({ technique: to, techniqueSettings: { netSize: 3 } })
          expect(next.technique).toBe(to)
          for (const [row, column, color] of [[0, 0, '#111111'], [0, 1, '#222222'], [3, 2, '#333333']] as const) {
            expect(colorAt(next.beads, row, column)).toBe(target.hasPosition({ row, column }) ? color : null)
          }
          expect(next.frame).toBe(start.frame)
        }
      }
    })

    it('takes the Net size given for Netting, and leaves none behind when it leaves Netting', () => {
      const net = changeCanvasWeave(framed(), { technique: 'netting', techniqueSettings: { netSize: 7 } })
      expect(net.techniqueSettings).toEqual({ netSize: 7 })
      expect(changeCanvasWeave(net, { technique: 'loom' }).techniqueSettings).toBeUndefined()
    })

    it('takes the Brick block given with the switch to brick stitch, and keeps the layer\'s own when none is given (ticket 568)', () => {
      expect(changeCanvasWeave(framed(), { technique: 'brick', techniqueSettings: { brickBlock: 3 } })).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })
      const brick = changeCanvasWeave(framed(), { technique: 'brick', techniqueSettings: { brickBlock: 4 } })
      expect(changeCanvasWeave(brick, { technique: 'peyote' }).techniqueSettings).toEqual({ brickBlock: 4 })
      const result = changeFrame(framed(), { technique: 'brick', techniqueSettings: { brickBlock: 2 } })
      expect(result.kind === 'changed' && result.project.frame).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 2 } })
      expect(changeFrame(framed(), { technique: 'loom', techniqueSettings: { brickBlock: 1 } }).kind).toBe('unchanged')
    })

    it('counts the beads a switch would drop', () => {
      const project = framed({ beads: { 0: { 0: '#111111', 1: '#222222' } } })
      // Netting of size 3 has no position at (0, 0) or (0, 1): both are holes.
      expect(switchLoss(project, 'canvas', 'netting', { netSize: 3 })).toBe(2)
      expect(switchLoss(project, 'canvas', 'peyote')).toBe(0)
    })

    it('changes the Brick block of a brick stitch Canvas', () => {
      const result = changeCanvasWeave(framed({ technique: 'brick' }), { techniqueSettings: { brickBlock: 3 } })
      expect(result.techniqueSettings).toEqual({ brickBlock: 3 })
      expect(result.frame?.techniqueSettings).toBeUndefined()
    })
  })

  describe('variants', () => {
    it('removes a line of the Frame\'s beads, closing the gap', () => {
      const project = framed({ frame: sheet(frame, withColors({}, [{ row: 0, column: 0, color: '#111111' }, { row: 1, column: 0, color: '#222222' }])) })
      const result = changeFrame(project, { removeLine: { axis: 'row', index: 0 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame).toMatchObject({ rows: 5, columns: 4 })
      expect(colorAt(result.project.frame!.beads, 0, 0)).toBe('#222222')
    })
  })

  describe('resize', () => {
    const beads = withColors({}, [{ row: 0, column: 0, color: '#111111' }, { row: 5, column: 3, color: '#222222' }])

    it('keeps the Frame\'s beads where they are on the Canvas when an edge above or to the left moves', () => {
      const result = changeFrame(framed({ frame: sheet(frame, beads) }), { set: { row: 8, column: 9, rows: 8, columns: 5 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(colorAt(result.project.frame!.beads, 2, 1)).toBe('#111111')
      expect(colorAt(result.project.frame!.beads, 7, 4)).toBe('#222222')
    })

    it('drops the beads a smaller Frame gives up onto the Canvas at their places (ticket 513)', () => {
      const canvas = withColors({}, [{ row: 50, column: 50, color: '#999999' }, { row: 14, column: 11, color: '#888888' }, { row: 12, column: 12, color: '#777777' }])
      const result = changeFrame(framed({ frame: sheet(frame, beads), beads: canvas }), { set: { row: 10, column: 10, rows: 3, columns: 4 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame!.beads).toEqual(withColors({}, [{ row: 0, column: 0, color: '#111111' }]))
      // Only the Frame's bead from the strip (rows 13-15) lands; the Canvas's own bead there shows again (ticket 0639).
      expect(result.project.beads).toEqual(withColors(canvas, [{ row: 15, column: 13, color: '#222222' }]))
    })

    it('drops the beads of a side given up from the left too, a Canvas bead under an empty position showing again (ticket 0639)', () => {
      const canvas = withColors({}, [{ row: 11, column: 10, color: '#999999' }])
      const result = changeFrame(framed({ frame: sheet(frame, beads), beads: canvas }), { set: { row: 10, column: 11, rows: 6, columns: 3 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.beads).toEqual(withColors(canvas, [{ row: 10, column: 10, color: '#111111' }]))
      expect(result.project.frame!.beads).toEqual(withColors({}, [{ row: 5, column: 2, color: '#222222' }]))
    })

    it('folds what a peyote Frame on a loom Canvas gives up from its top, leaving the Canvas alone (ticket 0638)', () => {
      const peyote = { ...sheet(frame, beads), technique: 'peyote' as const }
      const result = changeFrame(framed({ frame: peyote }), { set: { row: 12, column: 10, rows: 4, columns: 4 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.beads).toEqual({})
      expect(result.project.frame!.folded).toEqual(withColors({}, [{ row: -2, column: 0, color: '#111111' }]))
      expect(colorAt(result.project.frame!.beads, 3, 3)).toBe('#222222')
    })
  })

  describe('make a Frame around beads (Frame from Selection, Fit to drawing)', () => {
    const open = (beads: Project['beads'], overrides: Partial<Project> = {}): Project => {
      const project = framed({ beads, ...overrides })
      delete project.frame
      return project
    }

    it('lifts the Canvas beads inside it into the Frame, counted from its first row and column, and leaves the rest', () => {
      const beads = withColors({}, [{ row: 11, column: 12, color: '#111111' }, { row: 40, column: 40, color: '#999999' }])
      const result = changeFrame(open(beads), { make: frame })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame).toEqual(sheet(frame, withColors({}, [{ row: 1, column: 2, color: '#111111' }])))
      expect(result.project.beads).toEqual(withColors({}, [{ row: 40, column: 40, color: '#999999' }]))
    })

    it('puts the beads of a Frame there before back on the Canvas where they stand, and lifts again', () => {
      const earlier = framed({ frame: sheet(frame, withColors({}, [{ row: 0, column: 0, color: '#111111' }])) })
      const result = changeFrame(earlier, { make: { row: 8, column: 8, rows: 6, columns: 6 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(colorAt(result.project.frame!.beads, 2, 2)).toBe('#111111')
      expect(result.project.beads).toEqual({})
    })

    it('does not lift the Canvas beads hidden under the Frame it replaces', () => {
      const earlier = framed({ frame: sheet(frame, withColors({}, [{ row: 0, column: 0, color: '#111111' }])), beads: withColors({}, [{ row: 11, column: 11, color: '#999999' }]) })
      const result = changeFrame(earlier, { make: frame })
      expect(result.kind).toBe('unchanged')
      const wider = changeFrame(earlier, { make: { ...frame, rows: 8 } })
      if (wider.kind !== 'changed') throw new Error('expected a change')
      expect(wider.project.frame!.beads).toEqual({ 0: { 0: '#111111' } })
      expect(wider.project.beads).toEqual({ 11: { 11: '#999999' } })
    })

    it('gives the Frame the name of a named Piece it takes whole, and takes the name off the Canvas', () => {
      const beads = withColors({}, [{ row: 11, column: 12, color: '#111111' }])
      const result = changeFrame(open(beads, { pieceNames: [{ name: 'Cherry', row: 11, column: 12 }] }), { make: frame })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame?.name).toBe('Cherry')
      expect(result.project.pieceNames).toBeUndefined()
    })

    it('is refused when it would cut through a named Piece', () => {
      const beads = withColors({}, [{ row: 11, column: 12, color: '#111111' }, { row: 11, column: 14, color: '#111111' }, { row: 11, column: 13, color: '#111111' }])
      const named = open(beads, { pieceNames: [{ name: 'Cherry', row: 11, column: 12 }] })
      expect(changeFrame(named, { make: { row: 10, column: 10, rows: 3, columns: 4 } })).toEqual({ kind: 'refused', reason: 'cuts-schema' })
    })

    it('is no change when the Frame already wraps the same beads', () => {
      const project = framed({ frame: sheet(frame, withColors({}, [{ row: 0, column: 0, color: '#111111' }])) })
      expect(changeFrame(project, { make: frame })).toEqual({ kind: 'unchanged', project })
    })
  })

  describe('move (ticket 452)', () => {
    const frameBeads = withColors({}, [
      { row: 0, column: 0, color: '#111111' },
      { row: 0, column: 2, color: '#222222' },
    ])
    const canvas = withColors({}, [{ row: 4, column: 4, color: '#999999' }])

    it('carries the Frame\'s beads and touches nothing else', () => {
      const project = framed({ frame: sheet(frame, frameBeads), beads: canvas })
      const result = changeFrame(project, { move: { rows: 0, columns: 3 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.frame).toEqual(sheet({ ...frame, column: 13 }, frameBeads))
      expect(result.project.beads).toBe(canvas)
    })

    it('is allowed after Row progress has started, and the pointer stays with the Frame', () => {
      const project = framed({ frame: sheet(frame, frameBeads), rowProgress: woven('rows') })
      const result = changeFrame(project, { move: { rows: 2, columns: 0 } })
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(result.project.rowProgress).toMatchObject({ currentRow: 5, currentColumn: 3 })
    })

    it('moves by whole Canvas positions on peyote too: the Frame\'s own first row stays straight', () => {
      const project = framed({ technique: 'peyote', frame: { ...sheet(frame), technique: 'peyote' } })
      const result = changeFrame(project, { move: { rows: 1, columns: 0 } })
      expect(result.kind === 'changed' && result.project.frame?.row).toBe(11)
    })

    it('is no change for no distance', () => {
      expect(changeFrame(framed(), { move: { rows: 0, columns: 0 } }).kind).toBe('unchanged')
    })

    describe('the Canvas under the destination (ticket 489)', () => {
      const under = withColors(canvas, [{ row: 11, column: 16, color: '#333333' }])
      const movedRight = (project: Project, columns: number) => {
        const result = changeFrame(project, { move: { rows: 0, columns } })
        if (result.kind !== 'changed') throw new Error('expected a change')
        return result.project
      }

      it('is neither cleared nor changed: the Frame lies over it', () => {
        const moved = movedRight(framed({ frame: sheet(frame, frameBeads), beads: under }), 3)
        expect(moved.beads).toBe(under)
        expect(colorAt(moved.frame!.beads, 0, 0)).toBe('#111111')
      })

      it('is there again when the Frame moves off it', () => {
        const project = framed({ frame: sheet(frame, frameBeads), beads: under })
        const back = movedRight(movedRight(project, 3), -3)
        expect(back.beads).toBe(under)
        expect(back.frame).toEqual(project.frame)
      })

      it('is replaced by the Frame\'s beads when Remove Frame takes the Frame away', () => {
        const result = changeFrame(movedRight(framed({ frame: sheet(frame, frameBeads), beads: under }), 3), { remove: true })
        if (result.kind !== 'changed') throw new Error('expected a change')
        expect(colorAt(result.project.beads, 11, 16)).toBeNull()
        expect(colorAt(result.project.beads, 10, 13)).toBe('#111111')
      })
    })
  })
})

describe('Remove Frame keeps the Frame\'s beads (ticket 497)', () => {
  const frameBeads = withColors({}, [
    { row: 0, column: 0, color: '#111111' },
    { row: 0, column: 1, color: '#111111' },
    { row: 2, column: 3, color: '#222222' },
  ])
  const removed = (project: Project): Project => {
    const result = changeFrame(project, { remove: true })
    if (result.kind !== 'changed') throw new Error('expected a change')
    return result.project
  }

  it('drops the Frame\'s beads onto the Canvas where the Frame was', () => {
    const next = removed(framed({ frame: sheet(frame, frameBeads) }))
    expect(next.frame).toBeUndefined()
    expect(colorAt(next.beads, 10, 10)).toBe('#111111')
    expect(colorAt(next.beads, 12, 13)).toBe('#222222')
  })

  it('clears the Canvas beads under the whole footprint, empty Frame positions included, and leaves the rest', () => {
    const canvas = withColors({}, [{ row: 11, column: 11, color: '#999999' }, { row: 3, column: 3, color: '#888888' }])
    const next = removed(framed({ frame: sheet(frame, frameBeads), beads: canvas }))
    expect(colorAt(next.beads, 11, 11)).toBeNull()
    expect(colorAt(next.beads, 3, 3)).toBe('#888888')
  })

  it('lands cell by cell in the Canvas\'s geometry on a Technique with offset rows', () => {
    const next = removed(framed({ technique: 'peyote', frame: sheet({ ...frame, row: 12 }, frameBeads) }))
    expect(colorAt(next.beads, 12, 10)).toBe('#111111')
    expect(colorAt(next.beads, 14, 13)).toBe('#222222')
  })

  it('keeps the Frame\'s name on the Piece, the larger one when the beads form several', () => {
    const next = removed(framed({ frame: { ...sheet(frame, frameBeads), name: 'Cherry' } }))
    expect(next.pieceNames).toEqual([{ name: 'Cherry', row: 10, column: 10 }])
    expect(next.frame).toBeUndefined()
  })

  it('names the larger Piece when the Frame\'s first bead is on the smaller one', () => {
    const beads = withColors({}, [{ row: 0, column: 0, color: '#111111' }, { row: 2, column: 0, color: '#111111' }, { row: 2, column: 1, color: '#111111' }])
    const next = removed(framed({ frame: { ...sheet(frame, beads), name: 'Cherry' } }))
    expect(next.pieceNames).toEqual([{ name: 'Cherry', row: 12, column: 10 }])
  })

  it('yields its name to a named Canvas Piece it joins that is at least as large', () => {
    const owl = withColors({}, [{ row: 9, column: 10, color: '#999999' }, { row: 9, column: 11, color: '#999999' }])
    const lone = withColors({}, [{ row: 0, column: 0, color: '#111111' }])
    const next = removed(framed({ frame: { ...sheet(frame, lone), name: 'Cherry' }, beads: owl, pieceNames: [{ name: 'Owl', row: 9, column: 10 }] }))
    expect(next.pieceNames).toEqual([{ name: 'Owl', row: 9, column: 10 }])
  })

  it('clears the passes with the Frame', () => {
    const next = removed(framed({ frame: sheet(frame, frameBeads), rowProgress: woven('rows', 3, 2) }))
    expect(next.rowProgress).toMatchObject({ currentRow: 0, currentColumn: 0 })
  })
})

describe('changeFrame in Netting (ticket 485)', () => {
  const woven = () => createProject({ technique: 'netting', techniqueSettings: { netSize: 3 }, beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })

  it('switches the Frame to and from Netting, with its Net size (ticket 507)', () => {
    expect(changeFrame(woven(), { technique: 'peyote' }).kind).toBe('changed')
    const result = changeFrame(framed(), { technique: 'netting', techniqueSettings: { netSize: 5 } })
    expect(result.kind === 'changed' && result.project.frame).toMatchObject({ technique: 'netting', techniqueSettings: { netSize: 5 } })
  })

  it('drops the Frame\'s beads that fall in a hole, counted from its own corner, and is blocked once a pass is done (ticket 507)', () => {
    const start = framed({ frame: sheet(frame, { 0: { 0: '#111111' }, 1: { 1: '#222222' } }) })
    const result = changeFrame(start, { technique: 'netting', techniqueSettings: { netSize: 3 } })
    expect(result.kind === 'changed' && result.project.frame?.beads).toEqual({ 1: { 1: '#222222' } })
    expect(changeFrame({ ...start, rowProgress: { direction: 'rows', currentRow: 1, currentColumn: 0 } }, { technique: 'netting', techniqueSettings: { netSize: 3 } })).toEqual({ kind: 'refused', reason: 'locked' })
  })

  it('changes only the Net size when the Technique stays, and is no change for the size it has (ticket 568)', () => {
    const start = framed({ frame: sheet(frame, { 0: { 0: '#111111' }, 1: { 1: '#222222' } }) })
    const net = changeFrame(start, { technique: 'netting', techniqueSettings: { netSize: 3 } })
    const project = net.kind === 'changed' ? net.project : start
    const wider = changeFrame(project, { technique: 'netting', techniqueSettings: { netSize: 7 } })
    expect(wider.kind === 'changed' && wider.project.frame).toMatchObject({ technique: 'netting', techniqueSettings: { netSize: 7 } })
    expect(changeFrame(project, { technique: 'netting', techniqueSettings: { netSize: 3 } }).kind).toBe('unchanged')
    expect(changeCanvasWeave(changeCanvasWeave(framed(), { technique: 'netting', techniqueSettings: { netSize: 3 } }), { technique: 'netting', techniqueSettings: { netSize: 5 } }).techniqueSettings).toEqual({ netSize: 5 })
  })

  it('does not take out a single line, which is not a diamond', () => {
    expect(changeFrame(woven(), { removeLine: { axis: 'row', index: 0 } })).toEqual({ kind: 'refused', reason: 'fixed-weave' })
  })

  it('moves in whole diamonds', () => {
    const result = changeFrame(woven(), { move: { rows: 4, columns: 4 } })
    expect(result.kind === 'changed' && result.project.frame).toMatchObject({ row: 4, column: 4, rows: 7, columns: 13 })
  })
})

describe('changeFrame placing a Frame (ticket 495)', () => {
  const place = { frame: { row: 2, column: 3, rows: 8, columns: 5 }, weave: { technique: 'peyote' as const } }
  const canvas = withColors({}, [{ row: 3, column: 4, color: '#123456' }])

  it('puts an empty Frame in its own weave in place of the old one, leaving the Canvas as it is', () => {
    const old = framed({ frame: sheet({ row: 0, column: 0, rows: 3, columns: 3 }, withColors({}, [{ row: 0, column: 0, color: '#111111' }])), beads: canvas })
    const result = changeFrame(old, { place })
    expect(result.kind).toBe('changed')
    const next = (result as { project: Project }).project
    expect(next.frame).toMatchObject({ row: 2, column: 3, rows: 8, columns: 5, technique: 'peyote', beads: {} })
    expect(next.beads).toBe(canvas)
    expect(next.technique).toBe('loom')
  })

  it('restarts Row progress at the first pass', () => {
    const next = (changeFrame(framed({ rowProgress: woven('rows', 0, 0) }), { place }) as { project: Project }).project
    expect(next.rowProgress).toMatchObject({ currentRow: 0, currentColumn: 0 })
  })

  it('is refused once a pass is done', () => {
    expect(changeFrame(framed({ rowProgress: woven('rows', 3, 2) }), { place })).toEqual({ kind: 'refused', reason: 'locked' })
  })
})

describe('changing the Technique of a Frame over a Canvas woven alike (ADR 0066)', () => {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 11, height: 48, unit: 'beads' } })
  const withStrayBead = { ...base, beads: withColors({}, [{ row: 40, column: 3, color: '#e63746' }]), frame: sheet({ row: 0, column: 0, rows: 48, columns: 11 }) }

  it('leaves a Canvas bead in the rows it names but no longer covers, to be drawn on and erased', () => {
    const result = changeFrame(withStrayBead, { technique: 'peyote' })
    if (result.kind !== 'changed') throw new Error('expected a change')
    expect(colorAt(result.project.beads, 40, 3)).toBe('#e63746')
  })

  it('lays the Frame\'s beads on the Canvas where they stand when it is removed, over what is in those rows', () => {
    const peyote = changeFrame({ ...withStrayBead, frame: { ...withStrayBead.frame, beads: withColors({}, [{ row: 40, column: 3, color: '#2f6fed' }]) } }, { technique: 'peyote' })
    if (peyote.kind !== 'changed') throw new Error('expected a change')
    const removed = changeFrame(peyote.project, { remove: true })
    if (removed.kind !== 'changed') throw new Error('expected a change')
    expect(colorAt(removed.project.beads, 40, 3)).toBe('#2f6fed')
  })
})


describe('Folded beads: a Frame woven unlike the Canvas keeps what it gives up (ticket 0638, ADR 0066)', () => {
  const RED = '#111111'
  const BLUE = '#222222'
  const GREEN = '#333333'
  const GREY = '#999999'
  /** A peyote Frame on a loom Canvas: its rows nest closer than the Canvas's, so positions do not match one to one. */
  const peyote = (beads: FrameSheet['beads'], overrides: Partial<Project> = {}): Project => framed({ frame: { ...sheet(frame, beads), technique: 'peyote' }, ...overrides })
  const own = withColors({}, [{ row: 0, column: 0, color: RED }, { row: 1, column: 3, color: BLUE }, { row: 4, column: 2, color: GREEN }])
  const changed = (project: Project, change: FrameChange): Project => {
    const result = changeFrame(project, change)
    if (result.kind !== 'changed') throw new Error(`expected a change, got ${result.kind}`)
    return result.project
  }
  /** The Frame two columns narrower from its right edge. */
  const narrower = (project: Project) => changed(project, { set: { ...rectOf(project), columns: 2 } })
  const wider = (project: Project) => changed(project, { set: { ...rectOf(project), columns: 4 } })
  const rectOf = ({ frame }: Project): Rect => ({ row: frame!.row, column: frame!.column, rows: frame!.rows, columns: frame!.columns })

  it('folds what a smaller Frame gives up and leaves the Canvas as it is', () => {
    const canvas = withColors({}, [{ row: 11, column: 13, color: GREY }])
    const shrunk = narrower(peyote(own, { beads: canvas }))
    expect(shrunk.frame!.beads).toEqual(withColors({}, [{ row: 0, column: 0, color: RED }]))
    expect(shrunk.frame!.folded).toEqual(withColors({}, [{ row: 1, column: 3, color: BLUE }, { row: 4, column: 2, color: GREEN }]))
    expect(shrunk.beads).toBe(canvas)
  })

  it('shows its Folded beads again where they were when it grows back, from any edge', () => {
    const start = peyote(own)
    expect(wider(narrower(start)).frame).toEqual(start.frame)

    const fromTopLeft = changed(start, { set: { row: 12, column: 11, rows: 4, columns: 3 } })
    expect(fromTopLeft.frame!.beads).toEqual(withColors({}, [{ row: 2, column: 1, color: GREEN }]))
    const back = changed(fromTopLeft, { set: { row: fromTopLeft.frame!.row - 2, column: fromTopLeft.frame!.column - 1, rows: 6, columns: 4 } })
    expect(back.frame).toEqual(start.frame)
    expect(back.beads).toBe(start.beads)
  })

  it('shows a Folded bead over the Canvas bead under it, which stays on the Canvas, hidden', () => {
    const canvas = withColors({}, [{ row: 11, column: 13, color: GREY }])
    const grown = wider(narrower(peyote(own, { beads: canvas })))
    expect(colorAt(grown.frame!.beads, 1, 3)).toBe(BLUE)
    expect(grown.beads).toBe(canvas)
    expect(colorAt(shownBeads(grown), 11, 13)).toBe(BLUE)
  })

  it('keeps today\'s drop for a Frame woven like the Canvas, and still shows its Folded beads when it grows', () => {
    const folded = narrower(peyote(own))
    const loom = changed(folded, { technique: 'loom' })
    const shrunk = changed(loom, { set: { ...rectOf(loom), column: 11, columns: 1 } })
    expect(colorAt(shrunk.beads, 10, 10)).toBe(RED)
    expect(shrunk.frame!.folded).toEqual(withColors({}, [{ row: 1, column: 2, color: BLUE }, { row: 4, column: 1, color: GREEN }]))
    expect(wider(loom).frame!.beads).toEqual(own)
  })

  it('carries them with the Move handle', () => {
    const moved = changed(narrower(peyote(own)), { move: { rows: 0, columns: 5 } })
    const grown = wider(moved)
    expect(grown.frame).toMatchObject({ column: 15, beads: own })
  })

  it('re-weaves them with the Frame\'s Technique, keeping them folded when the Weaves come to match', () => {
    const folded = narrower(peyote(own))
    const matched = changed(folded, { technique: 'loom' })
    expect(matched.frame!.folded).toEqual(folded.frame!.folded)
    expect(matched.beads).toBe(folded.beads)
    const canvasMatched = changeCanvasWeave(folded, { technique: 'peyote' })
    expect(canvasMatched.frame!.folded).toEqual(folded.frame!.folded)

    // In a net of 3 the Folded bead at row 2, column 3 falls in a hole, as a bead the Frame shows would.
    const holed = narrower(peyote(withColors(own, [{ row: 2, column: 3, color: RED }])))
    expect(changed(holed, { technique: 'netting', techniqueSettings: { netSize: 3 } }).frame!.folded).toEqual(folded.frame!.folded)
  })

  it('shifts them with Remove row/column, the removed line\'s Folded beads going with it', () => {
    const folded = narrower(peyote(own))
    const shorter = changed(folded, { removeLine: { axis: 'row', index: 1 } })
    expect(shorter.frame!.folded).toEqual(withColors({}, [{ row: 3, column: 2, color: GREEN }]))
    const untouched = changed(folded, { removeLine: { axis: 'column', index: 0 } })
    expect(untouched.frame!.folded).toEqual(withColors({}, [{ row: 1, column: 2, color: BLUE }, { row: 4, column: 1, color: GREEN }]))
  })

  it('lays them on the Canvas where they stand when a Rectangular Frame is removed, over what is there', () => {
    const canvas = withColors({}, [{ row: 14, column: 12, color: GREY }])
    const removed = changed(narrower(peyote(own, { beads: canvas })), { remove: true })
    expect(removed.frame).toBeUndefined()
    expect(removed.beads).toEqual(withColors({}, [{ row: 10, column: 10, color: RED }, { row: 11, column: 13, color: BLUE }, { row: 14, column: 12, color: GREEN }]))
  })

  it('goes with a Custom frame when it is removed, leaving the Canvas as it is', () => {
    const canvas = withColors({}, [{ row: 40, column: 40, color: GREY }])
    const custom = changed(framed({ beads: canvas }), { custom: { kind: 'triangle', size: 4, centre: { row: 20, column: 30 } } })
    const withFolded = { ...custom, frame: { ...custom.frame!, folded: withColors({}, [{ row: -1, column: 0, color: RED }]) } }
    expect(changed(withFolded, { remove: true }).beads).toEqual(canvas)
  })

  it('lays them on the Canvas when a Frame is made elsewhere from a Selection', () => {
    const elsewhere = changed(narrower(peyote(own)), { make: { row: 40, column: 40, rows: 4, columns: 4 } })
    expect(elsewhere.frame!.folded).toBeUndefined()
    expect(elsewhere.beads).toEqual(withColors({}, [{ row: 10, column: 10, color: RED }, { row: 11, column: 13, color: BLUE }, { row: 14, column: 12, color: GREEN }]))
  })
})

describe('a Frame woven like the Canvas trades beads with it on a resize (ticket 0639, ADR 0066)', () => {
  const RED = '#111111'
  const BLUE = '#222222'
  const GREY = '#999999'
  const changed = (project: Project, change: FrameChange): Project => {
    const result = changeFrame(project, change)
    if (result.kind !== 'changed') throw new Error(`expected a change, got ${result.kind}`)
    return result.project
  }
  const rectOf = ({ frame }: Project): Rect => ({ row: frame!.row, column: frame!.column, rows: frame!.rows, columns: frame!.columns })
  const own = withColors({}, [{ row: 0, column: 0, color: RED }, { row: 1, column: 3, color: BLUE }, { row: 5, column: 2, color: RED }])

  it('lifts the Canvas beads it grows over, counted from its own first row and column, and leaves the rest', () => {
    const canvas = withColors({}, [{ row: 16, column: 11, color: GREY }, { row: 30, column: 30, color: BLUE }])
    const grown = changed(framed({ frame: sheet(frame, own), beads: canvas }), { set: { ...frame, rows: 8 } })
    expect(grown.frame!.beads).toEqual(withColors(own, [{ row: 6, column: 1, color: GREY }]))
    expect(grown.beads).toEqual(withColors({}, [{ row: 30, column: 30, color: BLUE }]))
  })

  it('does not lift the Canvas beads a Frame woven unlike it grows over: they stay, hidden', () => {
    const canvas = withColors({}, [{ row: 16, column: 11, color: GREY }])
    const grown = changed(framed({ frame: { ...sheet(frame, own), technique: 'peyote' }, beads: canvas }), { set: { ...frame, rows: 8 } })
    expect(grown.frame!.beads).toEqual(own)
    expect(grown.beads).toBe(canvas)
  })

  it.each([
    ['loom', {}],
    ['peyote', {}],
    ['brick', { techniqueSettings: { brickBlock: 2 } }],
  ] as const)('gives up its top rows to the Canvas and takes them back, leaving both as they were, on %s', (technique, weave) => {
    const canvas = withColors({}, [{ row: 30, column: 30, color: GREY }])
    const start = framed({ technique, ...weave, beads: canvas, frame: { ...sheet({ ...frame, row: 8, rows: 8 }, own), technique, ...weave } })
    const shrunk = changed(start, { set: frameWithEdgeStep(frameWeave(start), start.frame!, 'top', -1) })
    expect(shrunk.frame!.rows).toBeLessThan(8)
    expect(colorAt(shrunk.beads, 8, 10)).toBe(RED)
    const back = changed(shrunk, { set: frameWithEdgeStep(frameWeave(shrunk), shrunk.frame!, 'top', 1) })
    expect(back.frame).toEqual(start.frame)
    expect(back.beads).toEqual(start.beads)
  })

  it('shows its own Folded bead where the Canvas has one too, which stays on the Canvas, hidden, and lifts the rest', () => {
    const folded = { ...sheet(frame, own), folded: withColors({}, [{ row: 6, column: 1, color: BLUE }]) }
    const canvas = withColors({}, [{ row: 16, column: 11, color: GREY }, { row: 16, column: 12, color: GREY }])
    const grown = changed(framed({ frame: folded, beads: canvas }), { set: { ...frame, rows: 7 } })
    expect(grown.frame!.beads).toEqual(withColors(own, [{ row: 6, column: 1, color: BLUE }, { row: 6, column: 2, color: GREY }]))
    expect(grown.frame!.folded).toBeUndefined()
    expect(grown.beads).toEqual(withColors({}, [{ row: 16, column: 11, color: GREY }]))
  })

  it('leaves the Canvas beads in the keep-out margin it grows next to where they are', () => {
    const canvas = withColors({}, [{ row: 17, column: 11, color: GREY }])
    expect(changed(framed({ beads: canvas }), { set: { ...frame, rows: 7 } }).beads).toBe(canvas)
  })

  describe('a named Piece it grows over, taken whole or not at all', () => {
    // Cherry: two beads in rows 17 and 18, below the Frame's last row (15).
    const cherry = withColors({}, [{ row: 17, column: 11, color: RED }, { row: 18, column: 11, color: RED }])
    const named = (overrides: Partial<Project> = {}) => framed({ beads: withColors(cherry, [{ row: 16, column: 13, color: GREY }]), pieceNames: [{ name: 'Cherry', row: 17, column: 11 }], ...overrides })

    it('stops the growing edge at the Piece\'s edge, lifting what it covers before it', () => {
      const stopped = changed(named(), { set: { ...frame, rows: 8 } })
      expect(rectOf(stopped)).toEqual({ ...frame, rows: 7 })
      expect(stopped.frame!.beads).toEqual(withColors({}, [{ row: 6, column: 3, color: GREY }]))
      expect(stopped.beads).toEqual(cherry)
      expect(stopped.pieceNames).toEqual([{ name: 'Cherry', row: 17, column: 11 }])
    })

    it('stops a peyote top edge on a whole cycle of rows, so its first row stays unshifted', () => {
      const beads = withColors({}, [5, 6, 7].map((row) => ({ row, column: 11, color: RED })).concat({ row: 8, column: 13, color: GREY }))
      const peyote = framed({ technique: 'peyote', beads, pieceNames: [{ name: 'Cherry', row: 5, column: 11 }], frame: { ...sheet(frame), technique: 'peyote' } })
      const stopped = changed(peyote, { set: { ...frame, row: 6, rows: 10 } })
      expect(rectOf(stopped)).toEqual({ ...frame, row: 8, rows: 8 })
      expect(stopped.frame!.beads).toEqual(withColors({}, [{ row: 0, column: 3, color: GREY }]))
    })

    it('is no change when the edge is already at the Piece\'s edge', () => {
      const against = changed(named(), { set: { ...frame, rows: 7 } })
      expect(changeFrame(against, { set: { ...frame, rows: 8 } }).kind).toBe('unchanged')
    })

    it('keeps the other edges of a corner drag growing', () => {
      const stopped = changed(named(), { set: { ...frame, rows: 8, columns: 6 } })
      expect(rectOf(stopped)).toEqual({ ...frame, rows: 7, columns: 6 })
    })

    it('takes the Piece whole with its name once it covers it', () => {
      const taken = changed(named(), { set: { ...frame, rows: 9 } })
      expect(taken.frame!.beads).toEqual(withColors({}, [{ row: 6, column: 3, color: GREY }, { row: 7, column: 1, color: RED }, { row: 8, column: 1, color: RED }]))
      expect(taken.frame!.name).toBe('Cherry')
      expect(taken.beads).toEqual({})
      expect(taken.pieceNames).toBeUndefined()
    })

    it('takes the Piece\'s name over its own, as Frame from Selection does', () => {
      const taken = changed(named({ frame: { ...sheet(frame), name: 'Earring' } }), { set: { ...frame, rows: 9 } })
      expect(taken.frame!.name).toBe('Cherry')
      expect(taken.pieceNames).toBeUndefined()
    })

    it('grows on over a named Piece it already hides part of, leaving it on the Canvas, whole and hidden', () => {
      const under = framed({ beads: withColors({}, [14, 15, 16, 17].map((row) => ({ row, column: 11, color: RED }))), pieceNames: [{ name: 'Cherry', row: 14, column: 11 }] })
      const grown = changed(under, { set: { ...frame, rows: 7 } })
      expect(rectOf(grown)).toEqual({ ...frame, rows: 7 })
      expect(grown.frame!.beads).toEqual({})
      expect(grown.beads).toEqual(under.beads)
    })

    it('leaves a named Piece partly under it already on the Canvas, whole and hidden, so a strip given up and taken back is as it was', () => {
      const under = framed({ beads: withColors({}, [10, 11, 12].map((column) => ({ row: 12, column, color: RED }))), pieceNames: [{ name: 'Cherry', row: 12, column: 10 }] })
      const shrunk = changed(under, { set: { ...frame, column: 11, columns: 3 } })
      const back = changed(shrunk, { set: frame })
      expect(back.frame).toEqual(under.frame)
      expect(back.beads).toEqual(under.beads)
      expect(back.pieceNames).toEqual(under.pieceNames)
    })
  })
})

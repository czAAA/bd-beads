// @vitest-environment node
import { frameIdIn } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { type BeadMap, colorAt, type FrameSheet, type Rect, withColors } from './canvas'
import { TECHNIQUES } from './weave'
import { findBead } from './beads'
import { squareBead } from '../testUtils/squareBead'
import { replaceBead } from './projectBead'
import { changeCanvasWeave, changeFrame, frameChangeDiscardsProgress, type FrameChange } from './changeFrame'
import { shownBeads } from './layers'
import { createProject } from './createProject'
import { rowProgressOf, rowProgressOn } from './rowProgress'
import { frameWithEdgeStep, withFrame } from './frame'
import { frameWeave } from './layerWeave'
import type { Project, RowProgress } from './project'
import { beadsOfLayer, canvasOf, frameOf } from './layerRecord'
import { withFrameSheet } from './frameSheet'
import { frameSheetOf, type LayersChange, layersView, withLayers, pointersOf } from '../testUtils/layerFields'

const frame: Rect = { row: 10, column: 10, rows: 6, columns: 4 }

/** A Frame holding the beads given, counted from its own first row and column. */
const sheet = (rectangle: Rect, beads: FrameSheet['beads'] = {}): FrameSheet => ({ row: rectangle.row, column: rectangle.column, rows: rectangle.rows, columns: rectangle.columns, beads, technique: 'loom' })

function framed(overrides: LayersChange = {}): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  return withLayers(base, { frame: sheet(frame), ...overrides })
}

/** Row progress on an upright Frame, its rows running down (`rows`) or across (`columns`) as seen, with a pointer on
 * each of those two ways. */
const woven = (direction: 'rows' | 'columns', down = 5, right = 3): RowProgress => ({ way: direction === 'rows' ? 'down' : 'right', ...(down ? { down } : {}), ...(right ? { right } : {}) })

describe('changeFrame naming the Frame (ticket 555)', () => {
  it('sets the name, keeps the rest of the Frame, and an empty name clears it', () => {
    const named = changeFrame(framed(), { name: 'Moth wing' }, frameIdIn(framed()))
    if (named.kind !== 'changed') throw new Error('expected a change')
    expect(frameSheetOf(named.project)).toEqual({ ...sheet(frame), name: 'Moth wing' })
    const cleared = changeFrame(named.project, { name: '' }, frameIdIn(named.project))
    expect(cleared.kind === 'changed' && frameSheetOf(cleared.project)).toEqual(sheet(frame))
  })

  it('is no change for the name it already has, and refused with no Frame', () => {
    expect(changeFrame(framed(), { name: '' }, frameIdIn(framed())).kind).toBe('unchanged')
    const open = withFrameSheet(framed(), undefined, { frame: frameIdIn(framed()) })
    expect(changeFrame(open, { name: 'Moth' }, frameIdIn(open))).toEqual({ kind: 'refused', reason: 'no-frame' })
  })

  it('still names a Frame once a pass is done', () => {
    expect(changeFrame(framed({ rowProgress: woven('rows') }), { name: 'Moth' }, frameIdIn(framed({ rowProgress: woven('rows') }))).kind).toBe('changed')
  })
})

describe('changeFrame', () => {
  describe('refusals', () => {
    const changes: [string, FrameChange][] = [
      ['set', { set: { row: 0, column: 0, rows: 2, columns: 2 } }],
      ['technique settings', { techniqueSettings: { peyoteDrop: 2 } }],
    ]
    it.each(changes)('refuses %s once Row progress is on and a pass is done (ticket 411)', (_name, change) => {
      const project = framed({ rowProgress: woven('rows') })
      expect(changeFrame(project, change, frameIdIn(project))).toEqual({ kind: 'refused', reason: 'locked' })
    })

    it.each(changes)('allows %s while Row progress is on but no pass is done (ticket 411)', (_name, change) => {
      const project = framed({ rowProgress: woven('rows', 0, 0) })
      expect(changeFrame(project, change, frameIdIn(project)).kind).not.toBe('refused')
    })

    it('lets Remove Frame through with passes done, clearing them with the Frame (tickets 426, 0664)', () => {
      const project = framed({ rowProgress: woven('columns', 5, 3) })
      const result = changeFrame(project, { remove: true }, frameIdIn(project))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameOf(result.project)).toBeUndefined()
      expect(rowProgressOf(result.project, frameIdIn(result.project))).toEqual({ way: 'down' })
    })

    it('needs a Frame to remove a line from', () => {
      const none = withFrameSheet(framed(), undefined, { frame: frameIdIn(framed()) })
      expect(changeFrame(none, { removeLine: { axis: 'row', index: 0 } }, frameIdIn(none))).toEqual({ kind: 'refused', reason: 'no-frame' })
    })

    it('refuses a line the Frame does not have, and the only one it has', () => {
      expect(changeFrame(framed(), { removeLine: { axis: 'row', index: 6 } }, frameIdIn(framed()))).toEqual({ kind: 'refused', reason: 'no-line' })
      expect(changeFrame(framed(), { removeLine: { axis: 'column', index: -1 } }, frameIdIn(framed()))).toEqual({ kind: 'refused', reason: 'no-line' })
      const single = framed({ frame: sheet({ ...frame, rows: 1 }) })
      expect(changeFrame(single, { removeLine: { axis: 'row', index: 0 } }, frameIdIn(single))).toEqual({ kind: 'refused', reason: 'only-line' })
    })
  })

  describe('no change', () => {
    it('hands back the same Project for the same Frame, or for no Frame removed', () => {
      const project = framed()
      expect(changeFrame(project, { set: { ...frame } }, frameIdIn(project))).toEqual({ kind: 'unchanged', project })
      const none = withFrameSheet(framed(), undefined, { frame: frameIdIn(framed()) })
      const result = changeFrame(none, { remove: true }, frameIdIn(none))
      expect(result).toEqual({ kind: 'unchanged', project: none })
      expect(result.kind === 'unchanged' && result.project).toBe(none)
    })
  })

  describe('Row progress follows the Frame (ticket 426)', () => {
    const open = (): Project => {
      const project = withFrameSheet(framed(), undefined, { frame: frameIdIn(framed()) })
      return project
    }

    it('is on at the first Frame set, the pointers at the first pass (ticket 0664: Row progress is the Frame\'s)', () => {
      const result = changeFrame(open(), { set: frame }, frameIdIn(open()))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(rowProgressOf(result.project, frameIdIn(result.project))).toEqual({ way: 'down' })
      expect(rowProgressOn(result.project, frameIdIn(result.project))).toBe(true)
    })

    it('stays on for a Frame moved or resized, and comes on again when a removed Frame is set anew', () => {
      const turnedOn = changeFrame(open(), { set: frame }, frameIdIn(open()))
      if (turnedOn.kind !== 'changed') throw new Error('expected a change')
      const moved = changeFrame(turnedOn.project, { set: { ...frame, rows: 8 } }, frameIdIn(turnedOn.project))
      if (moved.kind !== 'changed') throw new Error('expected a change')
      expect(rowProgressOn(moved.project, frameIdIn(moved.project))).toBe(true)
      const removed = changeFrame(moved.project, { remove: true }, frameIdIn(moved.project))
      if (removed.kind !== 'changed') throw new Error('expected a change')
      expect(rowProgressOn(removed.project, frameIdIn(removed.project))).toBe(false)
      const reset = changeFrame(removed.project, { set: frame }, frameIdIn(removed.project))
      if (reset.kind !== 'changed') throw new Error('expected a change')
      expect(rowProgressOn(reset.project, frameIdIn(reset.project))).toBe(true)
      expect(pointersOf(rowProgressOf(reset.project, frameIdIn(reset.project)))).toEqual({})
    })
  })

  describe('frameChangeDiscardsProgress (ticket 434)', () => {
    const changes: FrameChange[] = [{ set: frame }, { removeLine: { axis: 'row', index: 0 } }, { technique: 'peyote' }]

    it('is true only for Remove Frame once a pass is done', () => {
      expect(frameChangeDiscardsProgress(framed({ rowProgress: woven('rows', 1, 0) }), { remove: true }, frameIdIn(framed({ rowProgress: woven('rows', 1, 0) })))).toBe(true)
      expect(frameChangeDiscardsProgress(framed({ rowProgress: woven('columns', 0, 2) }), { remove: true }, frameIdIn(framed({ rowProgress: woven('columns', 0, 2) })))).toBe(true)
    })

    it('is false for Remove Frame while no pass is done, since nothing is thrown away', () => {
      expect(frameChangeDiscardsProgress(framed({ rowProgress: woven('rows', 0, 0) }), { remove: true }, frameIdIn(framed({ rowProgress: woven('rows', 0, 0) })))).toBe(false)
      const unframed = withFrameSheet(framed(), undefined, { frame: frameIdIn(framed()) })
      expect(frameChangeDiscardsProgress(unframed as Project, { remove: true }, frameIdIn(unframed as Project))).toBe(false)
    })

    it.each(changes)('is false for every other change, passes done or not (%j)', (change) => {
      expect(frameChangeDiscardsProgress(framed({ rowProgress: woven('rows', 3, 0) }), change, frameIdIn(framed({ rowProgress: woven('rows', 3, 0) })))).toBe(false)
    })
  })

  describe('Row progress pointers', () => {
    it.each(['rows', 'columns'] as const)('keeps both pointers inside a smaller Frame (%s)', (direction) => {
      const wide = framed({ frame: sheet({ row: 10, column: 10, rows: 50, columns: 30 }), rowProgress: woven(direction, 40, 25) })
      const next = withFrame(wide, { row: 0, column: 0, rows: 2, columns: 2 }, frameIdIn(wide))
      // One past the last pass means every pass is done (ticket 411).
      expect((rowProgressOf(next, frameIdIn(next)).down ?? 0)).toBeLessThanOrEqual(2)
      expect((rowProgressOf(next, frameIdIn(next)).right ?? 0)).toBeLessThanOrEqual(2)
    })
  })

  describe('beads against the Frame', () => {
    it('leaves beads next to the new Frame where they are on the Canvas', () => {
      const open = withFrameSheet(framed(), undefined, { frame: frameIdIn(framed()) })
      const beads = withColors(beadsOfLayer(open, 'canvas'), [
        { row: 12, column: 8, color: '#00ff00' },
        { row: 8, column: 10, color: '#ff0000' },
        { row: 8, column: 11, color: '#ff0000' },
        { row: 40, column: 40, color: '#0000ff' },
      ])
      const result = changeFrame(withLayers(open, { beads }), { make: frame }, frameIdIn(open))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(beadsOfLayer(result.project, 'canvas')).toEqual(beads)
    })
  })

  describe('technique (the Frame\'s own, ticket 492)', () => {
    it('changes only the Frame\'s Technique: its beads, the Canvas and its place keep their rows and columns', () => {
      const project = framed({ frame: sheet(frame, withColors({}, [{ row: 1, column: 1, color: '#111111' }])), beads: withColors({}, [{ row: 40, column: 1, color: '#222222' }]) })
      const result = changeFrame(project, { technique: 'peyote' }, frameIdIn(project))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameSheetOf(result.project)).toEqual({ ...frameSheetOf(project), technique: 'peyote', techniqueSettings: { peyoteDrop: 1 } })
      expect(canvasOf(result.project).technique).toBe('loom')
      expect(beadsOfLayer(result.project, 'canvas')).toEqual(beadsOfLayer(project, 'canvas'))
    })

    it('moves a Frame whose rows are untouched to the starting way of its new Technique', () => {
      const result = changeFrame(framed(), { technique: 'peyote' }, frameIdIn(framed()))
      if (result.kind !== 'changed') throw new Error('expected a change')
      // Left to right as seen, on an upright Canvas: down the Frame's columns.
      expect(rowProgressOf(result.project, frameIdIn(result.project))).toEqual({ way: 'right' })
    })

    it('sets the new Technique\'s way even once the weaver has turned the rows by hand (spec 1182)', () => {
      const turned = framed({ ownProgress: { direction: 'rows', reversed: true, currentRow: 0, currentColumn: 0 } })
      const result = changeFrame(turned, { technique: 'peyote' }, frameIdIn(turned))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(rowProgressOf(result.project, frameIdIn(result.project))).toEqual({ way: 'right' })
    })

    it('is no change to the Technique it already has', () => {
      const project = framed()
      const result = changeFrame(project, { technique: 'loom' }, frameIdIn(project))
      expect(result.kind === 'unchanged' && result.project).toBe(project)
    })

    it('needs a Frame', () => {
      const none = withFrameSheet(framed(), undefined, { frame: frameIdIn(framed()) })
      expect(changeFrame(none, { technique: 'brick' }, frameIdIn(none))).toEqual({ kind: 'refused', reason: 'no-frame' })
    })

    it('leaves a Frame on an odd row where it is: its own row 0 is straight whatever the Canvas does', () => {
      const odd = framed({ frame: sheet({ row: 11, column: 10, rows: 6, columns: 4 }, withColors({}, [{ row: 0, column: 2, color: '#111111' }])) })
      const result = changeFrame(odd, { technique: 'peyote' }, frameIdIn(odd))
      expect(result.kind === 'changed' && frameSheetOf(result.project)).toEqual({ ...frameSheetOf(odd), technique: 'peyote', techniqueSettings: { peyoteDrop: 1 } })
    })
  })

  describe('Drop (ticket 477)', () => {
    const brick = () => framed({ frame: { ...sheet(frame), technique: 'brick' } })

    it('changes only the Frame\'s Drop: its place and beads keep their rows and columns', () => {
      const project = framed({ frame: { ...sheet({ row: 12, column: 3, rows: 6, columns: 4 }, withColors({}, [{ row: 1, column: 1, color: '#111111' }])), technique: 'brick' } })
      const result = changeFrame(project, { techniqueSettings: { brickDrop: 3 } }, frameIdIn(project))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameSheetOf(result.project)).toEqual({ ...frameSheetOf(project), techniqueSettings: { brickDrop: 3 } })
      expect(canvasOf(result.project).techniqueSettings).toBeUndefined()
    })

    it('is no change to the Drop it already has, and 1 when none is stored', () => {
      const project = brick()
      expect(changeFrame(project, { techniqueSettings: { brickDrop: 1 } }, frameIdIn(project))).toEqual({ kind: 'unchanged', project })
      const three = withLayers(project, { frame: { ...frameOf(project)!, techniqueSettings: { brickDrop: 3 } } })
      expect(changeFrame(three, { techniqueSettings: { brickDrop: 3 } }, frameIdIn(three))).toEqual({ kind: 'unchanged', project: three })
    })

    it('keeps the value when the Technique is switched away and back', () => {
      const three = withLayers(brick(), { frame: { ...frameOf(brick())!, techniqueSettings: { brickDrop: 3 } } })
      const peyote = changeFrame(three, { technique: 'peyote' }, frameIdIn(three))
      if (peyote.kind !== 'changed') throw new Error('expected a change')
      const back = changeFrame(peyote.project, { technique: 'brick' }, frameIdIn(peyote.project))
      expect(back.kind === 'changed' && frameOf(back.project)?.techniqueSettings?.brickDrop).toBe(3)
    })

    it('holds a value from 1 to 20', () => {
      const high = changeFrame(brick(), { techniqueSettings: { brickDrop: 99 } }, frameIdIn(brick()))
      expect(high.kind === 'changed' && frameOf(high.project)?.techniqueSettings?.brickDrop).toBe(20)
    })

    it('is refused once a pass is done (Row progress)', () => {
      const started = framed({ frame: { ...sheet(frame), technique: 'brick' }, rowProgress: woven('rows', 2, 0) })
      expect(changeFrame(started, { techniqueSettings: { brickDrop: 2 } }, frameIdIn(started))).toEqual({ kind: 'refused', reason: 'locked' })
    })
  })

  describe('the Canvas\'s Technique (ticket 492)', () => {
    it('switches at any time, even with a pass done, and leaves the Frame woven as it was', () => {
      const started = framed({ rowProgress: woven('rows', 2, 0), beads: withColors({}, [{ row: 40, column: 1, color: '#222222' }]) })
      const result = changeCanvasWeave(started, { technique: 'peyote' })
      expect(canvasOf(result).technique).toBe('peyote')
      expect(frameOf(result)?.technique).toBe('loom')
      expect(beadsOfLayer(result, 'canvas')).toEqual(beadsOfLayer(started, 'canvas'))
    })

    it('is the same Project for the Technique it has', () => {
      const project = framed()
      expect(changeCanvasWeave(project, { technique: 'loom' })).toBe(project)
    })

    it('switches between every ordered pair of Techniques, every bead keeping its row and column (tickets 507, 0644)', () => {
      const beads = { 0: { 0: '#111111', 1: '#222222' }, 3: { 2: '#333333' } }
      for (const from of TECHNIQUES) {
        for (const to of TECHNIQUES) {
          if (from === to) continue
          const start = framed({ technique: from, beads })
          const next = changeCanvasWeave(start, { technique: to })
          expect(canvasOf(next).technique).toBe(to)
          expect(beadsOfLayer(next, 'canvas')).toEqual(beads)
          expect(frameOf(next)).toBe(frameOf(start))
        }
      }
    })

    it('leaves behind no setting no Technique describes', () => {
      const stray = changeCanvasWeave(framed(), { technique: 'brick', techniqueSettings: { beadsPerLoop: 7 } })
      expect(canvasOf(stray).techniqueSettings).toEqual({ brickDrop: 1 })
    })

    it('takes the Drop given with the switch to brick stitch, and keeps the layer\'s own when none is given (ticket 568)', () => {
      expect(layersView(changeCanvasWeave(framed(), { technique: 'brick', techniqueSettings: { brickDrop: 3 } }))).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 3 } })
      const brick = changeCanvasWeave(framed(), { technique: 'brick', techniqueSettings: { brickDrop: 4 } })
      expect(canvasOf(changeCanvasWeave(brick, { technique: 'peyote' })).techniqueSettings).toEqual({ brickDrop: 4, peyoteDrop: 1 })
      const result = changeFrame(framed(), { technique: 'brick', techniqueSettings: { brickDrop: 2 } }, frameIdIn(framed()))
      expect(result.kind === 'changed' && frameOf(result.project)).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 2 } })
      expect(changeFrame(framed(), { technique: 'loom', techniqueSettings: { brickDrop: 1 } }, frameIdIn(framed())).kind).toBe('unchanged')
    })

    it('changes the Drop of a brick stitch Canvas', () => {
      const result = changeCanvasWeave(framed({ technique: 'brick' }), { techniqueSettings: { brickDrop: 3 } })
      expect(canvasOf(result).techniqueSettings).toEqual({ brickDrop: 3 })
      expect(frameOf(result)?.techniqueSettings).toBeUndefined()
    })
  })

  describe('variants', () => {
    it('removes a line of the Frame\'s beads, closing the gap', () => {
      const project = framed({ frame: sheet(frame, withColors({}, [{ row: 0, column: 0, color: '#111111' }, { row: 1, column: 0, color: '#222222' }])) })
      const result = changeFrame(project, { removeLine: { axis: 'row', index: 0 } }, frameIdIn(project))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameOf(result.project)).toMatchObject({ rows: 5, columns: 4 })
      expect(colorAt(frameOf(result.project)!.beads, 0, 0)).toBe('#222222')
    })
  })

  describe('resize', () => {
    const beads = withColors({}, [{ row: 0, column: 0, color: '#111111' }, { row: 5, column: 3, color: '#222222' }])

    it('keeps the Frame\'s beads where they are on the Canvas when an edge above or to the left moves', () => {
      const result = changeFrame(framed({ frame: sheet(frame, beads) }), { set: { row: 8, column: 9, rows: 8, columns: 5 } }, frameIdIn(framed({ frame: sheet(frame, beads) })))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(colorAt(frameOf(result.project)!.beads, 2, 1)).toBe('#111111')
      expect(colorAt(frameOf(result.project)!.beads, 7, 4)).toBe('#222222')
    })

    it('folds the beads a smaller Frame gives up and leaves the Canvas as it is, a Frame woven like it included (ticket 1215)', () => {
      const canvas = withColors({}, [{ row: 50, column: 50, color: '#999999' }, { row: 14, column: 11, color: '#888888' }, { row: 12, column: 12, color: '#777777' }])
      const result = changeFrame(framed({ frame: sheet(frame, beads), beads: canvas }), { set: { row: 10, column: 10, rows: 3, columns: 4 } }, frameIdIn(framed({ frame: sheet(frame, beads), beads: canvas })))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameOf(result.project)!.beads).toEqual(withColors({}, [{ row: 0, column: 0, color: '#111111' }]))
      expect(frameOf(result.project)!.folded).toEqual(withColors({}, [{ row: 5, column: 3, color: '#222222' }]))
      expect(beadsOfLayer(result.project, 'canvas')).toBe(beadsOfLayer(framed({ frame: sheet(frame, beads), beads: canvas }), 'canvas'))
    })

    it('folds the beads of a side given up from the left too, and shows them again when it grows back (ticket 1215)', () => {
      const shrunk = changeFrame(framed({ frame: sheet(frame, beads) }), { set: { row: 10, column: 11, rows: 6, columns: 3 } }, frameIdIn(framed({ frame: sheet(frame, beads) })))
      if (shrunk.kind !== 'changed') throw new Error('expected a change')
      expect(frameOf(shrunk.project)!.beads).toEqual(withColors({}, [{ row: 5, column: 2, color: '#222222' }]))
      expect(frameOf(shrunk.project)!.folded).toEqual(withColors({}, [{ row: 0, column: -1, color: '#111111' }]))
      const grown = changeFrame(shrunk.project, { set: frame }, frameIdIn(shrunk.project))
      if (grown.kind !== 'changed') throw new Error('expected a change')
      expect(frameOf(grown.project)!.beads).toEqual(beads)
      expect(frameOf(grown.project)!.folded).toBeUndefined()
    })

    it('takes nothing from the Canvas when it grows over it, the Canvas beads hidden under it (ticket 1215)', () => {
      const canvas = withColors({}, [{ row: 9, column: 11, color: '#999999' }])
      const result = changeFrame(framed({ frame: sheet(frame, beads), beads: canvas }), { set: { row: 8, column: 10, rows: 8, columns: 4 } }, frameIdIn(framed({ frame: sheet(frame, beads), beads: canvas })))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameOf(result.project)!.beads).toEqual(withColors({}, [{ row: 2, column: 0, color: '#111111' }, { row: 7, column: 3, color: '#222222' }]))
      expect(beadsOfLayer(result.project, 'canvas')).toEqual(canvas)
    })

    it('folds what a peyote Frame on a loom Canvas gives up from its top, leaving the Canvas alone (ticket 0638)', () => {
      const peyote = { ...sheet(frame, beads), technique: 'peyote' as const }
      const result = changeFrame(framed({ frame: peyote }), { set: { row: 12, column: 10, rows: 4, columns: 4 } }, frameIdIn(framed({ frame: peyote })))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(beadsOfLayer(result.project, 'canvas')).toEqual({})
      expect(frameOf(result.project)!.folded).toEqual(withColors({}, [{ row: -2, column: 0, color: '#111111' }]))
      expect(colorAt(frameOf(result.project)!.beads, 3, 3)).toBe('#222222')
    })
  })

  describe('make a Frame around beads (Frame from Selection, Fit to drawing)', () => {
    const open = (beads: BeadMap, overrides: LayersChange = {}): Project => {
      const project = withFrameSheet(framed({ beads, ...overrides }), undefined, { frame: frameIdIn(framed({ beads, ...overrides })) })
      return project
    }

    it('copies the Canvas beads inside it into the Frame, counted from its first row and column, the Canvas keeping every bead (ticket 1215)', () => {
      const beads = withColors({}, [{ row: 11, column: 12, color: '#111111' }, { row: 40, column: 40, color: '#999999' }])
      const result = changeFrame(open(beads), { make: frame }, frameIdIn(open(beads)))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameSheetOf(result.project)).toEqual(sheet(frame, withColors({}, [{ row: 1, column: 2, color: '#111111' }])))
      expect(beadsOfLayer(result.project, 'canvas')).toEqual(beads)
    })

    it('copies the beads you see of a Frame there before, which is replaced, and puts none on the Canvas', () => {
      const earlier = framed({ frame: sheet(frame, withColors({}, [{ row: 0, column: 0, color: '#111111' }])) })
      const result = changeFrame(earlier, { make: { row: 8, column: 8, rows: 6, columns: 6 } }, frameIdIn(earlier))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(colorAt(frameOf(result.project)!.beads, 2, 2)).toBe('#111111')
      expect(beadsOfLayer(result.project, 'canvas')).toEqual({})
    })

    it('does not copy the Canvas beads hidden under the Frame it replaces', () => {
      const earlier = framed({ frame: sheet(frame, withColors({}, [{ row: 0, column: 0, color: '#111111' }])), beads: withColors({}, [{ row: 11, column: 11, color: '#999999' }]) })
      const result = changeFrame(earlier, { make: frame }, frameIdIn(earlier))
      expect(result.kind).toBe('unchanged')
      const wider = changeFrame(earlier, { make: { ...frame, rows: 8 } }, frameIdIn(earlier))
      if (wider.kind !== 'changed') throw new Error('expected a change')
      expect(frameOf(wider.project)!.beads).toEqual({ 0: { 0: '#111111' } })
      expect(beadsOfLayer(wider.project, 'canvas')).toEqual({ 11: { 11: '#999999' } })
    })

    it('gives the Frame the name of a named Piece it takes whole, the Canvas keeping the Piece and its name', () => {
      const beads = withColors({}, [{ row: 11, column: 12, color: '#111111' }])
      const result = changeFrame(open(beads, { pieceNames: [{ name: 'Cherry', row: 11, column: 12 }] }), { make: frame }, frameIdIn(open(beads, { pieceNames: [{ name: 'Cherry', row: 11, column: 12 }] })))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameOf(result.project)?.name).toBe('Cherry')
      expect(canvasOf(result.project).pieceNames).toEqual([{ name: 'Cherry', row: 11, column: 12 }])
    })

    it('is made through a named Piece too, which stays whole on the Canvas', () => {
      const beads = withColors({}, [{ row: 11, column: 12, color: '#111111' }, { row: 11, column: 14, color: '#111111' }, { row: 11, column: 13, color: '#111111' }])
      const named = open(beads, { pieceNames: [{ name: 'Cherry', row: 11, column: 12 }] })
      const result = changeFrame(named, { make: { row: 10, column: 10, rows: 3, columns: 4 } }, frameIdIn(named))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(beadsOfLayer(result.project, 'canvas')).toEqual(beads)
      expect(canvasOf(result.project).pieceNames).toEqual([{ name: 'Cherry', row: 11, column: 12 }])
    })

    it('is no change when the Frame already wraps the same beads', () => {
      const project = framed({ frame: sheet(frame, withColors({}, [{ row: 0, column: 0, color: '#111111' }])) })
      expect(changeFrame(project, { make: frame }, frameIdIn(project))).toEqual({ kind: 'unchanged', project })
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
      const result = changeFrame(project, { move: { rows: 0, columns: 3 } }, frameIdIn(project))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(frameSheetOf(result.project)).toEqual(sheet({ ...frame, column: 13 }, frameBeads))
      expect(beadsOfLayer(result.project, 'canvas')).toBe(canvas)
    })

    it('is allowed after Row progress has started, and the pointer stays with the Frame', () => {
      const project = framed({ frame: sheet(frame, frameBeads), rowProgress: woven('rows') })
      const result = changeFrame(project, { move: { rows: 2, columns: 0 } }, frameIdIn(project))
      if (result.kind !== 'changed') throw new Error('expected a change')
      expect(pointersOf(rowProgressOf(result.project, frameIdIn(result.project)))).toEqual({ down: 5, right: 3 })
    })

    it('moves by whole Canvas positions on peyote too: the Frame\'s own first row stays straight', () => {
      const project = framed({ technique: 'peyote', frame: { ...sheet(frame), technique: 'peyote' } })
      const result = changeFrame(project, { move: { rows: 1, columns: 0 } }, frameIdIn(project))
      expect(result.kind === 'changed' && frameOf(result.project)?.row).toBe(11)
    })

    it('is no change for no distance', () => {
      expect(changeFrame(framed(), { move: { rows: 0, columns: 0 } }, frameIdIn(framed())).kind).toBe('unchanged')
    })

    describe('the Canvas under the destination (ticket 489)', () => {
      const under = withColors(canvas, [{ row: 11, column: 16, color: '#333333' }])
      const movedRight = (project: Project, columns: number) => {
        const result = changeFrame(project, { move: { rows: 0, columns } }, frameIdIn(project))
        if (result.kind !== 'changed') throw new Error('expected a change')
        return result.project
      }

      it('is neither cleared nor changed: the Frame lies over it', () => {
        const moved = movedRight(framed({ frame: sheet(frame, frameBeads), beads: under }), 3)
        expect(beadsOfLayer(moved, 'canvas')).toBe(under)
        expect(colorAt(frameOf(moved)!.beads, 0, 0)).toBe('#111111')
      })

      it('is there again when the Frame moves off it', () => {
        const project = framed({ frame: sheet(frame, frameBeads), beads: under })
        const back = movedRight(movedRight(project, 3), -3)
        expect(beadsOfLayer(back, 'canvas')).toBe(under)
        expect(frameSheetOf(back)).toEqual(frameSheetOf(project))
      })

      it('is still there when Remove Frame takes the Frame away, nothing dropped onto it (ticket 1215)', () => {
        const result = changeFrame(movedRight(framed({ frame: sheet(frame, frameBeads), beads: under }), 3), { remove: true }, frameIdIn(movedRight(framed({ frame: sheet(frame, frameBeads), beads: under }), 3)))
        if (result.kind !== 'changed') throw new Error('expected a change')
        expect(beadsOfLayer(result.project, 'canvas')).toBe(under)
      })
    })
  })
})

describe('Remove Frame takes the Frame\'s beads with it (tickets 497, 1215)', () => {
  const frameBeads = withColors({}, [
    { row: 0, column: 0, color: '#111111' },
    { row: 0, column: 1, color: '#111111' },
    { row: 2, column: 3, color: '#222222' },
  ])
  const removed = (project: Project): Project => {
    const result = changeFrame(project, { remove: true }, frameIdIn(project))
    if (result.kind !== 'changed') throw new Error('expected a change')
    return result.project
  }

  it('drops nothing onto the Canvas, on a Technique with offset rows too', () => {
    const canvas = withColors({}, [{ row: 11, column: 11, color: '#999999' }, { row: 3, column: 3, color: '#888888' }])
    const next = removed(framed({ frame: sheet(frame, frameBeads), beads: canvas }))
    expect(frameOf(next)).toBeUndefined()
    expect(beadsOfLayer(next, 'canvas')).toBe(canvas)
    const peyote = removed(framed({ technique: 'peyote', frame: sheet({ ...frame, row: 12 }, frameBeads) }))
    expect(beadsOfLayer(peyote, 'canvas')).toEqual({})
  })

  it('takes the Frame\'s name with it, the Canvas\'s Pieces keeping theirs', () => {
    const next = removed(framed({ frame: { ...sheet(frame, frameBeads), name: 'Cherry' }, beads: { 3: { 3: '#888888' } }, pieceNames: [{ name: 'Owl', row: 3, column: 3 }] }))
    expect(canvasOf(next).pieceNames).toEqual([{ name: 'Owl', row: 3, column: 3 }])
  })

  it('clears the passes with the Frame', () => {
    const next = removed(framed({ frame: sheet(frame, frameBeads), rowProgress: woven('rows', 3, 2) }))
    expect(pointersOf(rowProgressOf(next, frameIdIn(next)))).toEqual({})
  })
})

describe('changeFrame placing a Frame (ticket 495)', () => {
  const place = { frame: { row: 2, column: 3, rows: 8, columns: 5 }, weave: { technique: 'peyote' as const } }
  const canvas = withColors({}, [{ row: 3, column: 4, color: '#123456' }])

  it('puts an empty Frame in its own weave in place of the old one, leaving the Canvas as it is', () => {
    const old = framed({ frame: sheet({ row: 0, column: 0, rows: 3, columns: 3 }, withColors({}, [{ row: 0, column: 0, color: '#111111' }])), beads: canvas })
    const result = changeFrame(old, { place }, frameIdIn(old))
    expect(result.kind).toBe('changed')
    const next = (result as { project: Project }).project
    expect(frameOf(next)).toMatchObject({ row: 2, column: 3, rows: 8, columns: 5, technique: 'peyote', beads: {} })
    expect(beadsOfLayer(next, 'canvas')).toBe(canvas)
    expect(canvasOf(next).technique).toBe('loom')
  })

  it('holds the beads it is given that are inside it, as a Starter\'s design (ticket 0633)', () => {
    const beads = withColors({}, [{ row: 0, column: 0, color: '#111111' }, { row: 7, column: 4, color: '#222222' }, { row: 8, column: 0, color: '#333333' }])
    const next = (changeFrame(framed({ beads: canvas }), { place: { ...place, beads } }, frameIdIn(framed({ beads: canvas }))) as { project: Project }).project
    expect(frameOf(next)!.beads).toEqual(withColors({}, [{ row: 0, column: 0, color: '#111111' }, { row: 7, column: 4, color: '#222222' }]))
    expect(beadsOfLayer(next, 'canvas')).toBe(canvas)
  })

  it('restarts Row progress at the first pass', () => {
    const next = (changeFrame(framed({ rowProgress: woven('rows', 0, 0) }), { place }, frameIdIn(framed({ rowProgress: woven('rows', 0, 0) }))) as { project: Project }).project
    expect(pointersOf(rowProgressOf(next, frameIdIn(next)))).toEqual({})
  })

  it('is refused once a pass is done', () => {
    expect(changeFrame(framed({ rowProgress: woven('rows', 3, 2) }), { place }, frameIdIn(framed({ rowProgress: woven('rows', 3, 2) })))).toEqual({ kind: 'refused', reason: 'locked' })
  })
})

describe('changing the Technique of a Frame over a Canvas woven alike (ADR 0066)', () => {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 11, height: 48, unit: 'beads' } })
  const withStrayBead = withLayers(base, { beads: withColors({}, [{ row: 40, column: 3, color: '#e63746' }]), frame: sheet({ row: 0, column: 0, rows: 48, columns: 11 }) })

  it('leaves a Canvas bead in the rows it names but no longer covers, to be drawn on and erased', () => {
    const result = changeFrame(withStrayBead, { technique: 'peyote' }, frameIdIn(withStrayBead))
    if (result.kind !== 'changed') throw new Error('expected a change')
    expect(colorAt(beadsOfLayer(result.project, 'canvas'), 40, 3)).toBe('#e63746')
  })

  it('leaves the Canvas bead in those rows when it is removed, the Frame\'s beads going with it (ticket 1215)', () => {
    const peyote = changeFrame(withLayers(withStrayBead, { frame: { ...frameOf(withStrayBead)!, beads: withColors({}, [{ row: 40, column: 3, color: '#2f6fed' }]) } }), { technique: 'peyote' }, frameIdIn(withLayers(withStrayBead, { frame: { ...frameOf(withStrayBead)!, beads: withColors({}, [{ row: 40, column: 3, color: '#2f6fed' }]) } })))
    if (peyote.kind !== 'changed') throw new Error('expected a change')
    const removed = changeFrame(peyote.project, { remove: true }, frameIdIn(peyote.project))
    if (removed.kind !== 'changed') throw new Error('expected a change')
    expect(colorAt(beadsOfLayer(removed.project, 'canvas'), 40, 3)).toBe('#e63746')
  })
})


describe('Folded beads: a Frame keeps what it gives up (tickets 0638, 1215, ADR 0066)', () => {
  const RED = '#111111'
  const BLUE = '#222222'
  const GREEN = '#333333'
  const GREY = '#999999'
  /** A peyote Frame on a loom Canvas: its rows nest closer than the Canvas's, so positions do not match one to one. */
  const peyote = (beads: FrameSheet['beads'], overrides: LayersChange = {}): Project => framed({ frame: { ...sheet(frame, beads), technique: 'peyote', techniqueSettings: { peyoteDrop: 1 } }, ...overrides })
  const own = withColors({}, [{ row: 0, column: 0, color: RED }, { row: 1, column: 3, color: BLUE }, { row: 4, column: 2, color: GREEN }])
  const changed = (project: Project, change: FrameChange): Project => {
    const result = changeFrame(project, change, frameIdIn(project))
    if (result.kind !== 'changed') throw new Error(`expected a change, got ${result.kind}`)
    return result.project
  }
  /** The Frame two columns narrower from its right edge. */
  const narrower = (project: Project) => changed(project, { set: { ...rectOf(project), columns: 2 } })
  const wider = (project: Project) => changed(project, { set: { ...rectOf(project), columns: 4 } })
  const rectOf = (project: Project): Rect => {
    const { row, column, rows, columns } = frameOf(project)!
    return { row, column, rows, columns }
  }

  it('folds what a smaller Frame gives up and leaves the Canvas as it is', () => {
    const canvas = withColors({}, [{ row: 11, column: 13, color: GREY }])
    const shrunk = narrower(peyote(own, { beads: canvas }))
    expect(frameOf(shrunk)!.beads).toEqual(withColors({}, [{ row: 0, column: 0, color: RED }]))
    expect(frameOf(shrunk)!.folded).toEqual(withColors({}, [{ row: 1, column: 3, color: BLUE }, { row: 4, column: 2, color: GREEN }]))
    expect(beadsOfLayer(shrunk, 'canvas')).toBe(canvas)
  })

  it('shows its Folded beads again where they were when it grows back, from any edge', () => {
    const start = peyote(own)
    expect(frameSheetOf(wider(narrower(start)))).toEqual(frameSheetOf(start))

    const fromTopLeft = changed(start, { set: { row: 12, column: 11, rows: 4, columns: 3 } })
    expect(frameOf(fromTopLeft)!.beads).toEqual(withColors({}, [{ row: 2, column: 1, color: GREEN }]))
    const back = changed(fromTopLeft, { set: { row: frameOf(fromTopLeft)!.row - 2, column: frameOf(fromTopLeft)!.column - 1, rows: 6, columns: 4 } })
    expect(frameSheetOf(back)).toEqual(frameSheetOf(start))
    expect(beadsOfLayer(back, 'canvas')).toBe(beadsOfLayer(start, 'canvas'))
  })

  it('shows a Folded bead over the Canvas bead under it, which stays on the Canvas, hidden', () => {
    const canvas = withColors({}, [{ row: 11, column: 13, color: GREY }])
    const grown = wider(narrower(peyote(own, { beads: canvas })))
    expect(colorAt(frameOf(grown)!.beads, 1, 3)).toBe(BLUE)
    expect(beadsOfLayer(grown, 'canvas')).toBe(canvas)
    expect(colorAt(shownBeads(grown), 11, 13)).toBe(BLUE)
  })

  it('folds for a Frame woven like the Canvas too, and shows its Folded beads when it grows (ticket 1215)', () => {
    const folded = narrower(peyote(own))
    const loom = changed(folded, { technique: 'loom' })
    const shrunk = changed(loom, { set: { ...rectOf(loom), column: 11, columns: 1 } })
    expect(beadsOfLayer(shrunk, 'canvas')).toEqual(beadsOfLayer(loom, 'canvas'))
    expect(frameOf(shrunk)!.folded).toEqual(withColors({}, [{ row: 0, column: -1, color: RED }, { row: 1, column: 2, color: BLUE }, { row: 4, column: 1, color: GREEN }]))
    expect(frameOf(wider(loom))!.beads).toEqual(own)
  })

  it('carries them with the Move handle', () => {
    const moved = changed(narrower(peyote(own)), { move: { rows: 0, columns: 5 } })
    const grown = wider(moved)
    expect(frameOf(grown)).toMatchObject({ column: 15, beads: own })
  })

  it('re-weaves them with the Frame\'s Technique, keeping them folded when the Weaves come to match', () => {
    const folded = narrower(peyote(own))
    const matched = changed(folded, { technique: 'loom' })
    expect(frameOf(matched)!.folded).toEqual(frameOf(folded)!.folded)
    expect(beadsOfLayer(matched, 'canvas')).toBe(beadsOfLayer(folded, 'canvas'))
    const canvasMatched = changeCanvasWeave(folded, { technique: 'peyote' })
    expect(frameOf(canvasMatched)!.folded).toEqual(frameOf(folded)!.folded)
    expect(frameOf(changed(folded, { technique: 'brick' }))!.folded).toEqual(frameOf(folded)!.folded)
  })

  it('shifts them with Remove row/column, the removed line\'s Folded beads going with it', () => {
    const folded = narrower(peyote(own))
    const shorter = changed(folded, { removeLine: { axis: 'row', index: 1 } })
    expect(frameOf(shorter)!.folded).toEqual(withColors({}, [{ row: 3, column: 2, color: GREEN }]))
    const untouched = changed(folded, { removeLine: { axis: 'column', index: 0 } })
    expect(frameOf(untouched)!.folded).toEqual(withColors({}, [{ row: 1, column: 2, color: BLUE }, { row: 4, column: 1, color: GREEN }]))
  })

  it('go with the Frame when a Frame without a shape is removed, the Canvas as it is', () => {
    const canvas = withColors({}, [{ row: 14, column: 12, color: GREY }])
    const removed = changed(narrower(peyote(own, { beads: canvas })), { remove: true })
    expect(frameOf(removed)).toBeUndefined()
    expect(beadsOfLayer(removed, 'canvas')).toBe(canvas)
  })

  it('goes with a Custom frame when it is removed, leaving the Canvas as it is', () => {
    const canvas = withColors({}, [{ row: 40, column: 40, color: GREY }])
    const custom = changed(framed({ beads: canvas }), { custom: { shape: 'triangle', size: 4, centre: { row: 20, column: 30 } } })
    const withFolded = withLayers(custom, { frame: { ...frameOf(custom)!, folded: withColors({}, [{ row: -1, column: 0, color: RED }]) } })
    expect(beadsOfLayer(changed(withFolded, { remove: true }), 'canvas')).toEqual(canvas)
  })

  it('are left behind when a Frame is made elsewhere from a Selection, the Canvas as it is', () => {
    const start = narrower(peyote(own))
    const elsewhere = changed(start, { make: { row: 40, column: 40, rows: 4, columns: 4 } })
    expect(frameOf(elsewhere)!.folded).toBeUndefined()
    expect(beadsOfLayer(elsewhere, 'canvas')).toBe(beadsOfLayer(start, 'canvas'))
  })
})

describe('a Frame and the Canvas trade no bead on a resize (tickets 0639, 1215, ADR 0066)', () => {
  const RED = '#111111'
  const BLUE = '#222222'
  const GREY = '#999999'
  const changed = (project: Project, change: FrameChange): Project => {
    const result = changeFrame(project, change, frameIdIn(project))
    if (result.kind !== 'changed') throw new Error(`expected a change, got ${result.kind}`)
    return result.project
  }
  const own = withColors({}, [{ row: 0, column: 0, color: RED }, { row: 1, column: 3, color: BLUE }, { row: 5, column: 2, color: RED }])

  it('lifts no Canvas bead it grows over, whatever it is woven like: they stay, hidden', () => {
    const canvas = withColors({}, [{ row: 16, column: 11, color: GREY }, { row: 30, column: 30, color: BLUE }])
    for (const technique of ['loom', 'peyote'] as const) {
      const grown = changed(framed({ frame: { ...sheet(frame, own), technique }, beads: canvas }), { set: { ...frame, rows: 8 } })
      expect(frameOf(grown)!.beads).toEqual(own)
      expect(beadsOfLayer(grown, 'canvas')).toBe(canvas)
    }
  })

  it.each([
    ['loom', 'loom', {}],
    ['peyote', 'peyote', { techniqueSettings: { peyoteDrop: 1 } }],
    ['2-drop peyote', 'peyote', { techniqueSettings: { peyoteDrop: 2 } }],
    ['brick', 'brick', { techniqueSettings: { brickDrop: 2 } }],
  ] as const)('folds its top rows and takes them back, leaving the Canvas as it was, on %s', (_name, technique, weave) => {
    const canvas = withColors({}, [{ row: 30, column: 30, color: GREY }])
    const start = framed({ technique, ...weave, beads: canvas, frame: { ...sheet({ ...frame, row: 8, rows: 8 }, own), technique, ...weave } })
    const shrunk = changed(start, { set: frameWithEdgeStep(frameWeave(start, frameIdIn(start)), frameOf(start)!, 'top', -1) })
    expect(frameOf(shrunk)!.rows).toBeLessThan(8)
    expect(frameOf(shrunk)!.folded).toBeDefined()
    expect(beadsOfLayer(shrunk, 'canvas')).toBe(canvas)
    const back = changed(shrunk, { set: frameWithEdgeStep(frameWeave(shrunk, frameIdIn(shrunk)), frameOf(shrunk)!, 'top', 1) })
    expect(frameSheetOf(back)).toEqual(frameSheetOf(start))
    expect(beadsOfLayer(back, 'canvas')).toBe(canvas)
  })

  it('shows its own Folded bead again where the Canvas has a bead too, which stays on the Canvas, hidden', () => {
    const folded = { ...sheet(frame, own), folded: withColors({}, [{ row: 6, column: 1, color: BLUE }]) }
    const canvas = withColors({}, [{ row: 16, column: 11, color: GREY }, { row: 16, column: 12, color: GREY }])
    const grown = changed(framed({ frame: folded, beads: canvas }), { set: { ...frame, rows: 7 } })
    expect(frameOf(grown)!.beads).toEqual(withColors(own, [{ row: 6, column: 1, color: BLUE }]))
    expect(frameOf(grown)!.folded).toBeUndefined()
    expect(beadsOfLayer(grown, 'canvas')).toBe(canvas)
  })

  it('leaves a named Piece it grows over whole and named on the Canvas, hidden under it', () => {
    const cherry = withColors({}, [{ row: 17, column: 11, color: RED }, { row: 18, column: 11, color: RED }])
    const named = framed({ beads: cherry, pieceNames: [{ name: 'Cherry', row: 17, column: 11 }] })
    const grown = changed(named, { set: { ...frame, rows: 8 } })
    expect(frameOf(grown)).toMatchObject({ rows: 8, beads: {} })
    expect(beadsOfLayer(grown, 'canvas')).toBe(cherry)
    expect(canvasOf(grown).pieceNames).toEqual([{ name: 'Cherry', row: 17, column: 11 }])
    expect(frameOf(grown)!.name).toBeUndefined()
  })
})

describe('a Frame in a Bead of its own is read on the Canvas through millimetres (ticket 0665, ADR 0079)', () => {
  const RED = '#e63746'
  const BLUE = '#2f6fed'
  /** An 8/0 loom Canvas whose 4 by 4 Frame at row 2, column 3 is in 15/0 (half as wide) or in a Miyuki Delica 11/0. */
  function inOtherBead(beadId = 'toho/round/15-0', beads: BeadMap = {}): Project {
    const made = withLayers(createProject({ technique: 'loom', beadId: 'toho/round/8-0', size: { width: 4, height: 4, unit: 'beads' } }), { bead: squareBead(findBead('toho/round/8-0')!) })
    const framedIn = withLayers(made, { frame: { ...sheet({ row: 2, column: 3, rows: 4, columns: 4 }, beads) } })
    return replaceBead(framedIn, squareBead(findBead(beadId)!))
  }
  const halves = { 0: { 0: RED, 1: RED, 2: RED, 3: RED }, 1: { 0: RED, 1: RED, 2: RED, 3: RED }, 2: { 0: BLUE, 1: BLUE, 2: BLUE, 3: BLUE }, 3: { 0: BLUE, 1: BLUE, 2: BLUE, 3: BLUE } }

  it('takes its beads with it on Remove Frame, the Canvas as it is', () => {
    const canvas = { 2: { 3: '#000000', 5: '#000000' } }
    const removed = changeFrame(withLayers(inOtherBead(undefined, halves), { beads: canvas }), { remove: true }, frameIdIn(withLayers(inOtherBead(undefined, halves), { beads: canvas })))
    expect(removed.kind === 'changed' && beadsOfLayer(removed.project, 'canvas')).toEqual(canvas)
  })

  it('changes no Palette color or code on Remove Frame or on making a Frame, though the woven Bead changes (ADR 0103)', () => {
    const before = inOtherBead('miyuki/delica/11-0')
    const removed = changeFrame(before, { remove: true }, frameIdIn(before))
    if (removed.kind !== 'changed') throw new Error('expected a change')
    expect([removed.project.palette, removed.project.paletteCodes]).toEqual([before.palette, before.paletteCodes])
    const made = changeFrame(removed.project, { make: { row: 2, column: 3, rows: 2, columns: 2 } }, frameIdIn(removed.project))
    expect(made.kind === 'changed' && [made.project.palette, made.project.paletteCodes]).toEqual([before.palette, before.paletteCodes])
  })

  it('folds what a resize gives up rather than giving it to the Canvas, whose positions are not its own', () => {
    const resized = changeFrame(inOtherBead(undefined, halves), { set: { row: 2, column: 3, rows: 2, columns: 4 } }, frameIdIn(inOtherBead(undefined, halves)))
    if (resized.kind !== 'changed') throw new Error('expected a change')
    expect(frameOf(resized.project)!.folded).toEqual({ 2: halves[2], 3: halves[3] })
    expect(beadsOfLayer(resized.project, 'canvas')).toEqual({})
  })

  it("makes a Frame from a Selection in the Canvas's Bead, copying what the Frame there shows through millimetres", () => {
    const before = inOtherBead(undefined, halves)
    const made = changeFrame(before, { make: { row: 2, column: 3, rows: 2, columns: 2 } }, frameIdIn(before))
    if (made.kind !== 'changed') throw new Error('expected a change')
    expect(frameOf(made.project)).toMatchObject({ beadId: 'toho/round/8-0', id: frameOf(before)!.id })
    expect(beadsOfLayer(made.project, frameIdIn(made.project))).toEqual({ 0: { 0: RED, 1: RED }, 1: { 0: BLUE, 1: BLUE } })
  })
})

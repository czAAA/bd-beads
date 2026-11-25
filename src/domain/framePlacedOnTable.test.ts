// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from './canvas'
import { changeCanvasWeave, changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { deleteAll } from './drawing'
import { findBead } from './beads'
import { landedClear } from './frameLanding'
import { frameMet, stoppedMoveAt } from './frameSpacing'
import { withFrameCentre } from './framePlacement'
import { beadCount } from './canvas'
import { canvasWeave } from './layerWeave'
import { frameById, frameOf } from './layerRecord'
import { rotateFrame } from './rotate'
import { layerAt, shownBeads } from './layers'
import { piecesOf } from './pieces'
import { replaceBead } from './projectBead'
import { boxesMeet, coversOf, frameBoxesOf, layerUnder } from './sheets'
import type { Project } from './project'
import { frameIdIn } from '../testUtils/frameId'
import { withLayers } from '../testUtils/layerFields'
import { twoFrames, SECOND, firstOf } from '../testUtils/twoFrames'

/** One loom cube bead's width on the Table, in mm. */
const BEAD = 1.5

/** A peyote Canvas holding beads, a loom Frame turned a quarter on it, its centre off any bead grid (spec 1234). */
function turnedFrame(): Project {
  const base = createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 8, height: 8, unit: 'beads' } })
  const beads = withColors({}, [{ row: 1, column: 1, color: '#111111' }, { row: 30, column: 30, color: '#222222' }])
  const framed = withLayers(base, { beads, frame: { row: 10, column: 10, rows: 6, columns: 4, beads: {}, technique: 'brick' } })
  return withFrameCentre(rotateFrame(framed, undefined, frameIdIn(framed))!, { x: 37.3, y: 41.9 }, frameIdIn(framed))
}

describe('a Frame stays where it lies on the Table when the Canvas is edited (ticket 1237)', () => {
  const placeOf = (project: Project) => {
    const { centre, angle } = frameOf(project)!
    return { centre: { ...centre }, angle }
  }
  const before = turnedFrame()
  const same = placeOf(before)

  it('keeps a quarter turn that is not 0', () => {
    expect(same.angle).toBe(90)
  })

  it('is unmoved by the Canvas changing Technique', () => {
    expect(placeOf(changeCanvasWeave(before, { technique: 'brick' }))).toEqual(same)
    expect(placeOf(changeCanvasWeave(before, { technique: 'loom' }))).toEqual(same)
  })

  it('is unmoved by the Canvas changing its Drop', () => {
    const dropped = changeCanvasWeave(before, { techniqueSettings: { peyoteDrop: 2 } })
    expect(dropped).not.toBe(before)
    expect(placeOf(dropped)).toEqual(same)
  })

  it('is unmoved by the Canvas changing its Bead', () => {
    const other = findBead('toho-round-11-0')
    const changed = replaceBead(before, other ?? { ...findBead('toho-cube-1.5mm')!, id: 'x', widthMm: 2, heightMm: 2 }, 'canvas')
    expect(changed).not.toBe(before)
    expect(placeOf(changed)).toEqual(same)
  })

  it('is unmoved by Delete all', () => {
    const cleared = deleteAll(before)
    expect(cleared).not.toBe(before)
    expect(placeOf(cleared)).toEqual(same)
    expect(frameById(cleared, frameIdIn(cleared))!.angle).toBe(90)
  })
})

describe('a move on the Table (ticket 1237)', () => {
  const project = twoFrames({ row: 40, column: 40 })
  const [first, second] = [firstOf(project), SECOND]

  it('follows the pointer exactly, in mm, nothing snapping it to a bead', () => {
    const result = changeFrame(project, { move: { x: -2.37, y: 0.41 } }, second)
    if (result.kind !== 'changed') throw new Error('expected a change')
    const [was, now] = [frameById(project, second)!.centre, frameById(result.project, second)!.centre]
    expect(now.x).toBeCloseTo(was.x - 2.37, 9)
    expect(now.y).toBeCloseTo(was.y + 0.41, 9)
  })

  it('stops at the last place allowed, its sheet touching the other sheet, not meeting it', () => {
    const [own, other] = [frameBoxesOf(project, second)!, frameBoxesOf(project, first)!]
    // Straight left, far past the first Frame at the same height.
    const home = withFrameCentre(project, { x: frameById(project, second)!.centre.x, y: frameById(project, first)!.centre.y }, second)
    const delta = { x: -500, y: 0 }
    const allowed = stoppedMoveAt(home, second, delta)
    expect(allowed.y).toBeCloseTo(0, 9)
    const homeOwn = frameBoxesOf(home, second)!
    expect(allowed.x).toBeCloseTo(other.sheet.right - homeOwn.sheet.left, 9)
    expect(own).toBeDefined()
    // A move that would end inside the first Frame's sheet.
    const result = changeFrame(home, { move: { x: allowed.x - 3, y: 0 } }, second)
    if (result.kind !== 'changed') throw new Error('expected a change')
    const [a, b] = [frameBoxesOf(result.project, second)!, frameBoxesOf(result.project, first)!]
    expect(a.sheet.left).toBeCloseTo(b.sheet.right, 9)
    expect(boxesMeet(a.sheet, b.sheet)).toBe(false)
    expect(frameMet(result.project, second)).toBeUndefined()
  })

  it('lets sheets that only touch stay clear, and meets when they overlap', () => {
    const edge = frameBoxesOf(project, first)!.sheet
    const half = (frameBoxesOf(project, second)!.sheet.right - frameBoxesOf(project, second)!.sheet.left) / 2
    const y = frameById(project, first)!.centre.y
    const touching = withFrameCentre(project, { x: edge.right + half, y }, second)
    expect(frameMet(touching, second)).toBeUndefined()
    const overlapping = withFrameCentre(project, { x: edge.right + half - BEAD / 100, y }, second)
    expect(frameMet(overlapping, second)).toBe(first)
  })

  // A single large move is held at the first sheet on its way, never taken whole to a clear place beyond it.
  it('stoppedMoveAt stops a move that would pass clean through another sheet', () => {
    const home = withFrameCentre(project, { x: frameById(project, second)!.centre.x, y: frameById(project, first)!.centre.y }, second)
    expect(stoppedMoveAt(home, second, { x: -500, y: 0 }).x).toBeGreaterThan(-500)
  })

  it('changeFrame holds a move that would jump over another sheet at the one it meets', () => {
    const home = withFrameCentre(project, { x: frameById(project, second)!.centre.x, y: frameById(project, first)!.centre.y }, second)
    const result = changeFrame(home, { move: { x: -500, y: 0 } }, second)
    const placed = result.kind === 'changed' ? result.project : home
    expect(frameMet(placed, second)).toBeUndefined()
    expect(frameById(placed, second)!.centre.x).toBeGreaterThan(frameById(home, second)!.centre.x - 500)
  })

  it('goes the whole way where nothing is in its path', () => {
    expect(stoppedMoveAt(project, second, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 })
  })
})

describe('what lies under a sheet (ticket 1237)', () => {
  // Frame 6 rows by 4 columns at Canvas rows 10-15, columns 10-13, loom on a loom Canvas.
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 30, height: 30, unit: 'beads' } })
  const canvasBeads = withColors({}, [
    { row: 12, column: 11, color: '#111111' }, // under the Frame
    { row: 8, column: 8, color: '#222222' }, // in the margin, under the sheet
    { row: 2, column: 2, color: '#333333' }, // clear
    { row: 3, column: 3, color: '#333333' },
    { row: 12, column: 14, color: '#444444' }, // just right of the Frame, in the margin
    { row: 12, column: 15, color: '#444444' },
  ])
  const project = withLayers(base, { beads: canvasBeads, frame: { row: 10, column: 10, rows: 6, columns: 4, beads: {}, technique: 'loom' } })
  const frame = frameIdIn(project)

  it('reads the covered Canvas positions from the centre-in-rectangle test', () => {
    const [cover] = coversOf(project)
    expect(cover!.ref).toBe(frame)
    expect(cover!.frame).toEqual({ row: 10, column: 10, rows: 6, columns: 4 })
    expect(cover!.sheet).toEqual({ row: 6, column: 6, rows: 14, columns: 12 })
  })

  it('hides and does not count a Canvas bead under any sheet', () => {
    const shown = shownBeads(project)
    expect(Object.keys(shown)).toEqual(['2', '3'])
    expect(beadCount(shown)).toBe(2)
  })

  it('joins no Piece area to beads hidden under a sheet', () => {
    const pieces = piecesOf(shownBeads(project), canvasWeave(project))
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({ row: 2, column: 2, rows: 2, columns: 2 })
  })
})

describe('where a press goes (ticket 1237)', () => {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 30, height: 30, unit: 'beads' } })
  const project = withLayers(base, { frame: { row: 10, column: 10, rows: 6, columns: 4, beads: {}, technique: 'loom' } })
  const frame = frameIdIn(project)

  it('goes to the Frame over its own bead, to the Canvas elsewhere, its margin included', () => {
    expect(layerUnder(project, { row: 12, column: 11 })).toBe(frame)
    expect(layerAt(project, { row: 12, column: 11 })).toBe(frame)
    expect(layerUnder(project, { row: 8, column: 8 })).toBe('canvas')
    expect(layerUnder(project, { row: 16, column: 11 })).toBe('canvas')
    expect(layerUnder(project, { row: 12, column: 14 })).toBe('canvas')
  })

  it('goes to the Frame drawn on top where several hold the point', () => {
    const over = twoFrames({ row: 0, column: 0 })
    // The second Frame put right on the first: the later layer is on top.
    const stacked = withFrameCentre(over, frameById(over, firstOf(over))!.centre, SECOND)
    expect(layerUnder(stacked, { row: 2, column: 1 })).toBe(SECOND)
    expect(layerUnder(stacked, { row: 12, column: 12 })).toBe('canvas')
  })

  it('goes to the layer a position names, whatever lies under it', () => {
    expect(layerAt(project, { row: 12, column: 11, layer: 'canvas' })).toBe('canvas')
  })
})

describe('a new Frame lands at the nearest free spot (ticket 1237)', () => {
  it('moves a Frame put on another to a place that meets no sheet, no further than a Frame and its margins', () => {
    const project = twoFrames({ row: 1, column: 1 })
    expect(frameMet(project, SECOND)).toBe(firstOf(project))
    const landed = landedClear(project, SECOND)
    expect(frameMet(landed, SECOND)).toBeUndefined()
    const [a, b] = [frameBoxesOf(landed, SECOND)!.sheet, frameBoxesOf(landed, firstOf(landed))!.sheet]
    // Sheets touch: nearest free spot, not a spot further off.
    const gap = Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom)
    expect(gap).toBeCloseTo(0, 6)
  })

  it('leaves a clear Frame alone', () => {
    const project = twoFrames({ row: 40, column: 40 })
    expect(landedClear(project, SECOND)).toBe(project)
  })
})

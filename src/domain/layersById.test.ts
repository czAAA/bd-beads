import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeColorQuantities } from './beadQuantities'
import { findBead } from './beads'
import { colorAt } from './canvas'
import { changeFrame, type FrameChangeResult } from './changeFrame'
import { createProject } from './createProject'
import { deleteAll } from './drawing'
import { footprintOf } from './footprint'
import { framePlacement, withFrameAt } from './framePlacement'
import { withFrameSheet } from './frameSheet'
import type { FrameId } from './grid'
import {
  backgroundOf,
  beadsOfLayer,
  FIRST_FRAME,
  frameById,
  frameIdOf,
  frameOf,
  framesOf,
  layerOf,
  lettersOn,
  refOfFrame,
  withBackground,
  withLayer,
  withLetters,
  wovenLayerOf,
} from './layerRecord'
import { layerAt, onLayer, positionOnCanvas } from './layers'
import { withColors } from './canvas'
import { mirrorSettingOf, withMirrorPlace } from './mirror'
import { createPalette } from './palette'
import type { Project } from './project'
import { replaceBead } from './projectBead'
import { rotateFrame } from './rotate'
import { isInFinishedRow, moveToRow, rowProgressOf } from './rowProgress'
import { selectionInFinishedRows } from './selection'
import { placedStarter, starterById, designSizes } from './starters'
import { restoreSnapshot, snapshotOf } from './undoSnapshot'
import { withWeave } from './weaveSwitch'

// Ticket 1216: a Frame is named by its id, so every domain function given one touches that Frame and no other. The
// app makes one Frame; these Projects have two, the second named, the first left as it was.

const SECOND = frameIdOf({ id: 'second' })
const RED = '#ff0000'

/** A Project with two Frames: the first at the Canvas's top-left, the second, `SECOND`, further down and right. */
function twoFrames(): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  const first = withFrameSheet(base, { row: 0, column: 0, rows: 6, columns: 4, beads: {}, technique: 'loom' })
  return withFrameSheet(first, { row: 20, column: 20, rows: 6, columns: 4, beads: {}, technique: 'loom' }, { frame: SECOND })
}

/** The first Frame's id in a Project. */
const firstOf = (project: Project): FrameId => frameIdOf(framesOf(project)[0]!)

/** The Project a Frame change made; fails on a refused one. */
function changed(result: FrameChangeResult): Project {
  if (result.kind !== 'changed') throw new Error(`refused: ${result.kind}`)
  return result.project
}

/** That the first Frame came through `change` as it was. */
function firstUntouched(before: Project, after: Project): void {
  expect(frameById(after, firstOf(before))).toEqual(frameById(before, firstOf(before)))
}

describe('a Frame named by its id (ticket 1216)', () => {
  it('reads and writes only the Frame named', () => {
    const project = twoFrames()
    expect(framesOf(project).map((frame) => frame.id)[1]).toBe('second')
    expect(frameById(project, SECOND)).toMatchObject({ row: 20, column: 20 })
    expect(frameById(project, 'canvas')).toBeUndefined()
    // The old name is the first Frame, as the UI still calls it.
    expect(frameById(project, FIRST_FRAME)).toBe(frameOf(project))
    expect(refOfFrame(project, frameById(project, SECOND)!)).toBe(SECOND)
    expect(refOfFrame(project, frameOf(project)!)).toBe(FIRST_FRAME)

    const painted = withLayer(project, SECOND, { beads: withColors({}, [{ row: 1, column: 1, color: RED }]), name: 'Earring' })
    firstUntouched(project, painted)
    expect(layerOf(painted, SECOND)).toMatchObject({ name: 'Earring' })
    expect(colorAt(beadsOfLayer(painted, SECOND)!, 1, 1)).toBe(RED)

    const lettered = withBackground(withLetters(project, SECOND, true), SECOND, 2)
    firstUntouched(project, lettered)
    expect([lettersOn(lettered, SECOND), backgroundOf(lettered, SECOND)]).toEqual([true, 2])
  })

  it('removes only the Frame named', () => {
    const project = twoFrames()
    const removed = withFrameSheet(project, undefined, { frame: SECOND })
    expect(framesOf(removed)).toEqual([frameOf(project)])
  })

  it('places a press, paints and weaves anew on the Frame under it', () => {
    const project = twoFrames()
    expect(layerAt(project, { row: 21, column: 21 })).toBe(SECOND)
    expect(layerAt(project, { row: 1, column: 1 })).toBe(FIRST_FRAME)
    expect(positionOnCanvas(project, SECOND, { row: 1, column: 2 })).toEqual({ row: 21, column: 22 })
    expect(footprintOf(project, SECOND)).toEqual({ row: 20, column: 20, rows: 6, columns: 4 })

    const painted = onLayer(project, SECOND, (sheet) => withColors(sheet.beads, [{ row: 0, column: 0, color: RED }]))
    firstUntouched(project, painted)
    expect(colorAt(beadsOfLayer(painted, SECOND)!, 0, 0)).toBe(RED)

    const rewoven = withWeave(project, SECOND, { technique: 'peyote' })
    firstUntouched(project, rewoven)
    expect(frameById(rewoven, SECOND)!.technique).toBe('peyote')
  })

  it('moves, turns and removes only the Frame named', () => {
    const project = twoFrames()
    const moved = changed(changeFrame(project, { move: { rows: 2, columns: 3 } }, SECOND))
    firstUntouched(project, moved)
    expect(frameById(moved, SECOND)).toMatchObject({ row: 22, column: 23 })

    const turned = rotateFrame(project, 'keep', SECOND)!
    firstUntouched(project, turned)
    expect(frameById(turned, SECOND)!.quarterTurns).toBe(1)

    const at = framePlacement(project, SECOND)!.at
    const carried = withFrameAt(project, { x: at.x + 2, y: at.y }, SECOND)
    firstUntouched(project, carried)
    expect(frameById(carried, SECOND)!.column).toBe(22)

    const removed = changed(changeFrame(project, { remove: true }, SECOND))
    expect(framesOf(removed).map((frame) => frame.id)).toEqual([firstOf(project)])
  })

  it('keeps Row progress, its lock and Beads needed per Frame', () => {
    const project = withLayer(twoFrames(), SECOND, { beads: withColors({}, [{ row: 0, column: 0, color: RED }]) })
    const woven = moveToRow(project, 2, SECOND)
    firstUntouched(project, woven)
    expect(rowProgressOf(woven, SECOND).down).toBe(2)
    expect(isInFinishedRow(woven, { row: 20, column: 20, layer: SECOND }, SECOND)).toBe(true)
    expect(isInFinishedRow(woven, { row: 0, column: 0 })).toBe(false)
    expect(selectionInFinishedRows(woven, { top: 20, left: 20, rows: 1, columns: 1, layer: SECOND })).toBe(true)

    const palette = createPalette([RED])
    expect(computeColorQuantities(project, palette, SECOND).map(({ count }) => count)).toEqual([1])
    expect(computeColorQuantities(project, palette)).toEqual([])
  })

  it('puts back each Frame as it was, keeping its Letters as they are now', () => {
    const project = twoFrames()
    const entry = snapshotOf(project)
    const painted = withLetters(withLayer(project, SECOND, { beads: withColors({}, [{ row: 0, column: 0, color: RED }]) }), SECOND, true)
    const restored = restoreSnapshot(painted, entry)
    firstUntouched(project, restored)
    expect(beadsOfLayer(restored, SECOND)).toEqual({})
    expect(lettersOn(restored, SECOND)).toBe(true)
  })

  it('empties every Frame on Delete all and keeps them', () => {
    const project = moveToRow(withLayer(twoFrames(), SECOND, { beads: withColors({}, [{ row: 0, column: 0, color: RED }]) }), 1, SECOND)
    const emptied = deleteAll(project)
    expect(framesOf(emptied)).toHaveLength(2)
    expect(beadsOfLayer(emptied, SECOND)).toEqual({})
    expect(rowProgressOf(emptied, SECOND).down).toBeUndefined()
  })

  it('mirrors, swaps the Bead of and places a Starter on only the Frame named', () => {
    const project = twoFrames()
    const mirrored = withMirrorPlace(project, { layer: 'frame', frame: SECOND })
    expect(mirrorSettingOf(mirrored).place).toEqual({ layer: 'frame', frame: SECOND })

    const delica = findBead('miyuki/delica/11-0')!
    const swapped = replaceBead(project, delica, SECOND)
    firstUntouched(project, swapped)
    expect(layerOf(swapped, SECOND)!.beadId).toBe(delica.id)
    // The Palette still follows the woven layer, the first Frame, until it is the Project's own (ticket 1225).
    expect(wovenLayerOf(swapped)).toBe(FIRST_FRAME)
    expect(swapped.palette).toEqual(project.palette)

    const starter = starterById('triangle')
    const placed = changed(placedStarter(project, starter, { sizes: designSizes(starter), useDesign: true }, { row: 30, column: 30 }, SECOND))
    firstUntouched(project, placed)
    expect(frameById(placed, SECOND)!.shape).toBe('triangle')
    // A Custom frame named turns about its own centre, in its own Weave.
    const turned = rotateFrame(placed, 'keep', SECOND)!
    firstUntouched(project, turned)
    expect(frameById(turned, SECOND)!.quarterTurns).toBe(1)
  })

  it('is how every domain and renderer module reaches a Frame: never by its place in the list', () => {
    const modules = ['domain', 'rendering'].flatMap((folder) => {
      const dir = join(import.meta.dirname, '..', folder)
      return readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.includes('.test.') && name !== 'layerRecord.ts').map((name) => join(dir, name))
    })
    const reading = modules.filter((path) => /\bframeOf\(|\blayers\[1\]|\bheldFrame\(/.test(readFileSync(path, 'utf8')))
    expect(reading).toEqual([])
  })
})

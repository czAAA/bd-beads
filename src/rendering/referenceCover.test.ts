// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { pictureCover, pressOnPicture } from './referenceCover'
import { findBead } from '../domain/beads'
import { createProject } from '../domain/createProject'
import { customFrameSize } from '../domain/frameShape'
import { frameOf, withLayer } from '../domain/layerRecord'
import { canvasWeave, frameWeave } from '../domain/layerWeave'
import type { Weave } from '../domain/weave'
import { withLayers } from '../testUtils/layerFields'
import { squareBead } from '../testUtils/squareBead'
import { OPEN_SPACE } from './space'
import { surfaceView } from './surfaceView'

// Loom with a square Bead: a position's bead is 20 × 20 grid px, its centre at (column × 20 + 10, row × 20 + 10).
const loom: Weave & { cell: { aspect: number; roundness: number } } = { technique: 'loom', cell: { aspect: 1, roundness: 0 } }

describe('the positions a reference image covers (ReferenceImage card: the size)', () => {
  it('is every Canvas position whose centre lies on the picture, the box round them giving columns × rows', () => {
    // 80 × 40 grid px round (100, 60): x 60 to 140, y 40 to 80.
    const cover = pictureCover(loom, { x: 100, y: 60, width: 80, angle: 0 }, 40)
    expect(cover.box).toEqual({ row: 2, column: 3, rows: 2, columns: 4 })
    expect(cover.positions).toHaveLength(8)
  })

  it('takes a turned picture as it lies', () => {
    const cover = pictureCover(loom, { x: 100, y: 60, width: 80, angle: 90 }, 40)
    expect(cover.box).toEqual({ row: 1, column: 4, rows: 4, columns: 2 })
  })

  it('leaves out the corners a picture turned 45° does not reach', () => {
    const cover = pictureCover(loom, { x: 100, y: 100, width: 100, angle: 45 }, 100)
    const box = cover.box!
    expect(cover.positions.length).toBeLessThan(box.rows * box.columns)
    expect(cover.positions.some((position) => position.row === box.row && position.column === box.column)).toBe(false)
  })

  it('says where on the picture each position lies, from its top-left as fractions of its width and height', () => {
    const cover = pictureCover(loom, { x: 40, y: 10, width: 80, angle: 0 }, 20)
    expect(cover.positions.map(({ column, u, v }) => [column, u, v])).toEqual([
      [0, 0.125, 0.5],
      [1, 0.375, 0.5],
      [2, 0.625, 0.5],
      [3, 0.875, 0.5],
    ])
  })

  it('covers nothing when the picture falls between the centres', () => {
    expect(pictureCover(loom, { x: 20, y: 20, width: 4, angle: 0 }, 4)).toMatchObject({ positions: [], box: undefined })
  })

  it('gives only the box of a picture too big to convert, without listing its positions', () => {
    const cover = pictureCover(loom, { x: 10_000, y: 10_000, width: 20_000, angle: 0 }, 20_000)
    expect(cover.positions).toEqual([])
    expect(cover.box).toEqual({ row: 0, column: 0, rows: 1000, columns: 1000 })
    expect(cover.listed).toBe(false)
  })
})

describe('where a pressed bead lies on the picture (Pick color, ticket 1119)', () => {
  const round8 = findBead('toho/round/8-0')!
  const round15 = findBead('toho/round/15-0')!
  /** A loom Canvas of square 8/0 beads (centres at column × 20 + 10, row × 20 + 10), a 4 by 4 Frame at row 2, column 3. */
  function framed(frameBead = round8) {
    const made = withLayers(createProject({ technique: 'loom', beadId: round8.id, size: { width: 4, height: 4, unit: 'beads' } }), { bead: squareBead(round8) })
    return withLayer(withLayers(made, { frame: { ...frameOf(made)!, row: 2, column: 3 } }), 'frame', { bead: squareBead(frameBead) })
  }
  // 200 × 200 grid px from the Canvas's corner: a point's u and v are its x and y over 200.
  const picture = { x: 100, y: 100, width: 200, angle: 0 }
  const at = (found: { u: number; v: number } | undefined) => found && [found.u, found.v].map((part) => Math.round(part * 1000) / 1000)

  it("reads a Canvas bead's centre, and a Frame's alike with the Canvas at the same place", () => {
    expect(at(pressOnPicture(withLayers(framed(), { frame: undefined }), { row: 2, column: 3 }, undefined, picture, 200))).toEqual([0.35, 0.25])
    expect(at(pressOnPicture(framed(), { row: 2, column: 3 }, 'frame', picture, 200))).toEqual([0.35, 0.25])
  })

  it("reads a Frame bead of a smaller Bead where the Frame draws it, through its Bead's size", () => {
    const smaller = framed(round15)
    expect(at(pressOnPicture(smaller, { row: 2, column: 3 }, undefined, picture, 200))).toEqual([0.325, 0.225])
    expect(at(pressOnPicture(smaller, { row: 3, column: 4 }, 'frame', picture, 200))).toEqual([0.375, 0.275])
  })

  it('reads the Canvas under the Frame when the press names the Canvas', () => {
    expect(at(pressOnPicture(framed(round15), { row: 3, column: 4 }, 'canvas', picture, 200))).toEqual([0.45, 0.35])
  })

  it('reads a turned Frame bead where it lies turned (ticket 0667)', () => {
    // A 4 by 6 loom Frame at (0, 0), turned once: its first bead lies at the top right, its last at the bottom left.
    const turned = withLayers(framed(), { frame: { row: 0, column: 0, rows: 4, columns: 6, technique: 'loom', quarterTurns: 1, beads: {} } })
    expect(at(pressOnPicture(turned, { row: 0, column: 0 }, 'frame', picture, 200))).toEqual([0.35, 0.05])
    expect(at(pressOnPicture(turned, { row: 3, column: 5 }, 'frame', picture, 200))).toEqual([0.05, 0.55])
  })

  it("reads a Custom frame's bead where the Canvas draws it, named by round and place", () => {
    const sheet = { row: 0, column: 0, ...customFrameSize('triangle', { rounds: 4 }), technique: 'peyote' as const, shape: 'triangle' as const, settings: { rounds: 4 } }
    const custom = withLayers(createProject({ technique: 'peyote', beadId: round8.id, size: { width: 20, height: 20, unit: 'beads' } }), { bead: squareBead(round8), frame: { ...sheet, beads: {} } })
    const weave = canvasWeave(custom)
    const view = surfaceView({ space: OPEN_SPACE, technique: 'peyote', cell: weave.cell, frame: { ...frameOf(custom)!, ...frameWeave(custom) }, rotation: 0, zoom: 1 })
    const drawn = view.beadToPoint({ row: 3, column: 5 }, 'frame')
    expect(at(pressOnPicture(custom, { row: 3, column: 5 }, 'frame', picture, 200))).toEqual(at({ u: drawn.x / 200, v: drawn.y / 200 }))
  })

  it('is none off the picture', () => {
    expect(pressOnPicture(framed(), { row: 0, column: 0 }, undefined, { x: 100, y: 100, width: 40, angle: 0 }, 40)).toBeUndefined()
  })
})

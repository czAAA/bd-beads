// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { OPEN_SPACE, type Space } from './space'
import { CELL_SIZE_PX } from './cellSize'
import { projectExtentPx, surfaceView } from './surfaceView'
import { customFrameSize, frameGeometry } from '../domain/frameShape'

const TECHNIQUES: Technique[] = ['loom', 'peyote', 'brick']
const ROTATIONS: Rotation[] = [0, 90, 180, 270]
const COLUMNS = 6
const ROWS = 5

/** The Project drawn on its own: the Frame alone with its first bead at the origin. */
const FRAME_ONLY = (technique: Technique): Space => ({
  open: false,
  origin: { row: 0, column: 0 },
  columns: COLUMNS,
  rows: ROWS,
  hasFrame: true,
  toAbsolute: { row: 0, column: 0 },
  extent: projectExtentPx(technique, COLUMNS, ROWS),
})
const SPACES = { open: () => OPEN_SPACE, 'frame only': FRAME_ONLY } as const
const VIEWS = [
  { zoom: 1, scroll: { x: 0, y: 0 } },
  { zoom: 2.5, scroll: { x: 37, y: -12 } },
  { zoom: 0.4, scroll: { x: -90, y: 140 } },
]
const BEADS = [
  { row: 0, column: 0 },
  { row: 1, column: 2 },
  { row: 4, column: 5 },
  { row: 3, column: 0 },
]

describe('a Drop shifts rows in blocks (ticket 477)', () => {
  it('draws N rows straight, then N shifted half a bead, and finds each bead under its centre', () => {
    const view = surfaceView({ space: OPEN_SPACE, technique: 'brick', techniqueSettings: { brickDrop: 2 }, rotation: 0, zoom: 1 })
    const xs = [0, 1, 2, 3, 4].map((row) => view.beadToPoint({ row, column: 0 }).x)
    expect(xs).toEqual([10, 10, 20, 20, 10])
    for (const row of [0, 1, 2, 3, 4, -1, -3]) {
      expect(view.pointToBead(view.beadToPoint({ row, column: 3 }))).toEqual({ row, column: 3 })
    }
  })
})

describe('the Surface view maps beads and points both ways', () => {
  describe.each(TECHNIQUES)('%s', (technique) => {
    describe.each(Object.entries(SPACES))('in the %s space', (_name, spaceOf) => {
      describe.each(ROTATIONS)('turned %i°', (rotation) => {
        it.each(VIEWS)('finds the bead at the point its centre is drawn at (zoom $zoom)', ({ zoom, scroll }) => {
          const view = surfaceView({ space: spaceOf(technique), technique, rotation, zoom, scroll })
          for (const bead of BEADS) {
            expect(view.pointToBead(view.beadToPoint(bead))).toEqual(bead)
            expect(view.pointToCell(view.beadToPoint(bead))).toEqual(bead)
          }
        })
      })
    })

    it('gives no bead for a point outside a Project drawn on its own, and the nearest cell for one on the Canvas', () => {
      const own = surfaceView({ space: FRAME_ONLY(technique), technique, rotation: 0, zoom: 1 })
      expect(own.pointToBead({ x: -3, y: 5 })).toBeUndefined()
      expect(own.pointToBead({ x: COLUMNS * CELL_SIZE_PX + 20, y: 5 })).toBeUndefined()
      const open = surfaceView({ space: OPEN_SPACE, technique, rotation: 0, zoom: 1 })
      expect(open.pointToBead({ x: -35, y: -35 })).toBeDefined()
    })
  })

  it('finds no bead in a half-bead gap beside a shifted row', () => {
    const view = surfaceView({ space: FRAME_ONLY('peyote'), technique: 'peyote', rotation: 0, zoom: 1 })
    // Row 1 is shifted half a bead right, so its first 10px has no bead; row 0 does not reach down that far at the middle of row 1.
    expect(view.pointToBead({ x: 5, y: view.beadToPoint({ row: 1, column: 0 }).y })).toBeUndefined()
    expect(view.pointToBead({ x: 15, y: view.beadToPoint({ row: 1, column: 0 }).y })).toEqual({ row: 1, column: 0 })
  })

  it('stacks brick stitch rows a bead apart, with no seam between them', () => {
    const view = surfaceView({ space: OPEN_SPACE, technique: 'brick', rotation: 0, zoom: 1 })
    expect(view.pointToBead({ x: 5, y: CELL_SIZE_PX - 0.5 })).toEqual({ row: 0, column: 0 })
    expect(view.pointToBead({ x: 5, y: CELL_SIZE_PX + 0.5 })).toEqual({ row: 1, column: -1 })
  })

  it('gives the overlap of two nested peyote rows to the one drawn later, but not in its rounded corner', () => {
    const view = surfaceView({ space: OPEN_SPACE, technique: 'peyote', rotation: 0, zoom: 1 })
    // Row 1 starts at y = 15 and row 0 reaches to 20: the overlap is row 1's, except where its corner is cut away.
    expect(view.pointToBead({ x: 20, y: 17 })).toEqual({ row: 1, column: 0 })
    expect(view.pointToBead({ x: 10.5, y: 15.2 })).toEqual({ row: 0, column: 0 })
  })

  it('shifts a layer’s rows by their own number, its row 0 always straight (ticket 492)', () => {
    const view = surfaceView({ space: FRAME_ONLY('peyote'), technique: 'peyote', rotation: 0, zoom: 1 })
    expect(view.beadToPoint({ row: 0, column: 0 })).toEqual({ x: 10, y: 10 })
    expect(view.beadToPoint({ row: 1, column: 0 })).toEqual({ x: 20, y: 25 })
  })
})

describe('the Surface view lays out a block of beads', () => {
  const block = { row: 2, column: 3, rows: 4, columns: 5 }
  const open = (technique: Technique, rotation: Rotation, zoom = 1, extra = {}) => surfaceView({ space: OPEN_SPACE, technique, rotation, zoom, ...extra })

  it('measures it from the bead at row 0, column 0, with an offset technique’s extra half bead', () => {
    expect(open('loom', 0).beadBox(block)).toEqual({ x: 60, y: 40, width: 100, height: 80 })
    expect(open('brick', 0).beadBox({ ...block, row: 0 })).toMatchObject({ x: 60, y: 0, width: 110 })
  })

  it('finds where it lands once turned and zoomed, as an upright rectangle less the scroll', () => {
    expect(open('loom', 0, 2).beadBox(block)).toEqual({ x: 120, y: 80, width: 200, height: 160 })
    expect(open('loom', 90).beadBox(block)).toEqual({ x: -120, y: 60, width: 80, height: 100 })
    expect(open('loom', 0, 2, { scroll: { x: 20, y: 30 } }).beadBox(block)).toEqual({ x: 100, y: 50, width: 200, height: 160 })
  })

  it('puts the Frame’s line round its beads', () => {
    expect(open('loom', 0).frameBox(block)).toEqual({ x: 53, y: 33, width: 114, height: 94 })
  })

  it('turns a direction without zooming it', () => {
    expect(open('loom', 90, 3).gridDirection(1, 0)).toEqual({ x: 0, y: 1 })
    expect(open('loom', 270, 3).gridDirection(0, 1)).toEqual({ x: 1, y: 0 })
  })

  it('says how far a step along a row and one down are on screen', () => {
    expect(open('loom', 0, 2).beadStep()).toEqual({ column: { x: 40, y: 0 }, row: { x: 0, y: 40 } })
    expect(open('brick', 0).beadStep().row).toEqual({ x: 0, y: 20 })
    expect(open('peyote', 90).beadStep().column).toEqual({ x: 0, y: 20 })
  })

  it('centres a block in a viewport, or the origin when there is none', () => {
    const viewport = { width: 400, height: 300 }
    expect(open('loom', 0, 1, { viewport }).scrollToCentre({ row: 2, column: 5, rows: 5, columns: 10 })).toEqual({ x: 0, y: -60 })
    expect(open('loom', 0, 1, { viewport }).scrollToCentre()).toEqual({ x: -200, y: -150 })
  })

  it('keeps the point under the anchor still while the zoom changes', () => {
    const view = open('loom', 0, 1, { scroll: { x: 30, y: 10 } })
    // The displayed point under the anchor was (130, 60) at zoom 1, so it is (260, 120) at zoom 2, and still 100,50 from the corner.
    expect(view.scrollAfterZoom({ x: 100, y: 50 }, 2)).toEqual({ x: 160, y: 70 })
  })

  it('fits a block with a margin, never zooming in past 100%, to a whole percent rounded down', () => {
    const fit = (width: number, height: number, margin = 20) => open('loom', 0, 1, { viewport: { width, height } }).zoomToFit(block, { width: margin, height: margin })
    expect(fit(1000, 1000)).toBe(1)
    expect(fit(140, 140)).toBe(1)
    expect(fit(90, 1000)).toBe(0.5)
    // 418 across 30 beads of 20px is 69.67%.
    const wide = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1, viewport: { width: 418, height: Infinity } })
    expect(wide.zoomToFit({ row: 0, column: 0, rows: 4, columns: 30 }, { width: 0, height: 0 })).toBe(0.69)
  })

  it('counts an offset technique’s half bead in the width it fits', () => {
    const viewport = { width: 480, height: Infinity }
    const wide = { row: 0, column: 0, rows: 10, columns: 24 }
    expect(surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1, viewport }).zoomToFit(wide, { width: 0, height: 0 })).toBe(1)
    expect(surfaceView({ space: OPEN_SPACE, technique: 'peyote', rotation: 0, zoom: 1, viewport }).zoomToFit(wide, { width: 0, height: 0 })).toBeLessThan(1)
  })
})

describe('the Surface view with a Frame woven in its own Technique (ticket 492)', () => {
  // A 4 × 4 peyote Frame at row 2, column 3 of a loom Canvas: its corner is the Canvas position (2, 3), at (60, 40).
  const frame = { technique: 'peyote' as const, row: 2, column: 3, rows: 4, columns: 4 }
  const view = (extra = {}) => surfaceView({ space: OPEN_SPACE, technique: 'loom', frame, rotation: 0, zoom: 1, ...extra })

  it('lays the Frame\'s beads out in its own Weave from its corner: row 1 shifted half a bead and nested', () => {
    expect(view().beadToPoint({ row: 2, column: 3 })).toEqual({ x: 70, y: 50 })
    expect(view().beadToPoint({ row: 3, column: 3 })).toEqual({ x: 80, y: 65 })
  })

  it('lays the Canvas out in the Canvas\'s', () => {
    expect(view().beadToPoint({ row: 0, column: 0 })).toEqual({ x: 10, y: 10 })
    expect(view().beadToPoint({ row: 7, column: 8 })).toEqual({ x: 170, y: 150 })
  })

  it('says which bead of the Frame a point is on, as the Frame\'s position from its first', () => {
    expect(view().pointToBead({ x: 70, y: 50 })).toEqual({ row: 2, column: 3 })
    expect(view().pointToBead({ x: 80, y: 65 })).toEqual({ row: 3, column: 3 })
  })

  it('says which bead of the Canvas a point is on beside the Frame', () => {
    expect(view().pointToBead({ x: 10, y: 10 })).toEqual({ row: 0, column: 0 })
    expect(view().pointToBead({ x: 170, y: 150 })).toEqual({ row: 7, column: 8 })
  })

  it('answers the Canvas in the rows the Frame claims but does not reach (ADR 0066)', () => {
    // Four peyote rows are 65 px tall; the rectangle they name is 80 px: the strip below the Frame is Canvas, the same
    // position as the Frame's own last row.
    expect(view().pointToBead({ x: 70, y: 40 + 70 })).toEqual({ row: 5, column: 3 })
  })

  it('says which layer a point is on where a Frame bead and a Canvas bead share a position', () => {
    expect(view().pointToHit({ x: 70, y: 40 + 55 })).toEqual({ row: 5, column: 3, layer: 'frame' })
    expect(view().pointToHit({ x: 70, y: 40 + 70 })).toEqual({ row: 5, column: 3, layer: 'canvas' })
    expect(view().pointToHit({ x: 10, y: 10 })).toEqual({ row: 0, column: 0, layer: 'canvas' })
  })

  it('measures a block of the Frame in the Frame\'s Weave and a block of the Canvas in the Canvas\'s', () => {
    expect(view().beadBox(frame, 'frame')).toMatchObject({ x: 60, y: 40, height: 65 })
    expect(view().beadBox({ row: 0, column: 0, rows: 2, columns: 2 })).toMatchObject({ x: 0, y: 0, width: 40, height: 40 })
  })

  it('finds the cell nearest a point in the geometry asked for', () => {
    expect(view().pointToCell({ x: 80, y: 65 }, 'frame')).toEqual({ row: 3, column: 3 })
    expect(view().pointToCell({ x: 80, y: 65 }, 'canvas')).toEqual({ row: 3, column: 4 })
  })

  it('steps a layer by its own Weave', () => {
    expect(view().beadStep('frame').row.y).toBe(15)
    expect(view().beadStep('canvas').row.y).toBe(20)
  })
})

describe('the Surface view with a Frame in a Bead half as wide as the Canvas\'s (ticket 0665)', () => {
  // A 4 × 4 loom Frame at row 2, column 3 of a loom Canvas: its corner at (60, 40), each of its beads 10 px across.
  const frame = { technique: 'loom' as const, row: 2, column: 3, rows: 4, columns: 4, scale: 0.5 }
  const view = surfaceView({ space: OPEN_SPACE, technique: 'loom', frame, rotation: 0, zoom: 1 })

  it('draws the Frame\'s beads at half the size from its corner, and finds each under its centre', () => {
    expect(view.beadToPoint({ row: 2, column: 3 })).toEqual({ x: 65, y: 45 })
    expect(view.beadToPoint({ row: 5, column: 6 }, 'frame')).toEqual({ x: 95, y: 75 })
    expect(view.pointToHit({ x: 95, y: 75 })).toEqual({ row: 5, column: 6, layer: 'frame' })
  })

  it('leaves the Canvas positions it does not reach to the Canvas, and covers only those it draws over', () => {
    expect(view.pointToHit({ x: 110, y: 50 })).toEqual({ row: 2, column: 5, layer: 'canvas' })
    expect(view.beadBox(frame, 'frame')).toMatchObject({ x: 60, y: 40, width: 40, height: 40 })
    const line = view.frameBox(frame)
    expect([line.x + line.width / 2, line.y + line.height / 2]).toEqual([80, 60])
  })

  it('steps the Frame by its own beads, and finds the cell nearest a point in them', () => {
    expect(view.beadStep('frame').column.x).toBe(10)
    expect(view.beadStep('canvas').column.x).toBe(20)
    expect(view.pointToCell({ x: 96, y: 76 }, 'frame')).toEqual({ row: 5, column: 6 })
  })
})

describe('A Bead\'s cell finds beads where they are drawn (ADR 0068)', () => {
  const cell = { aspect: 1.3 / 1.6, roundness: 0.1 }
  const TECHS: Technique[] = ['loom', 'peyote', 'brick']

  it('puts each bead under its own centre in every Technique and rotation', () => {
    for (const technique of TECHS) {
      for (const rotation of ROTATIONS) {
        const view = surfaceView({ space: OPEN_SPACE, technique, cell, rotation, zoom: 1.5, scroll: { x: 11, y: -7 } })
        for (const position of [{ row: 0, column: 0 }, { row: 2, column: 1 }, { row: 4, column: 3 }]) {
          expect(view.pointToBead(view.beadToPoint(position))).toEqual(position)
        }
      }
    }
  })

  it('steps down by the Bead height, not the square', () => {
    const real = surfaceView({ space: OPEN_SPACE, technique: 'loom', cell, rotation: 0, zoom: 1 }).beadStep().row
    const ownCell = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1 }).beadStep().row
    expect(real.y).toBeCloseTo(CELL_SIZE_PX * cell.aspect)
    expect(ownCell.y).toBe(CELL_SIZE_PX)
  })
})

describe('a Custom frame on the Canvas (ticket 0592)', () => {
  const frame = { row: 0, column: 0, ...customFrameSize('triangle', { rounds: 4 }), technique: 'peyote' as const, shape: 'triangle' as const, settings: { rounds: 4 } }
  const view = surfaceView({ space: OPEN_SPACE, technique: 'peyote', frame, rotation: 0, zoom: 1 })
  const { box } = frameGeometry(frame).place({ row: 3, column: 5 })!
  const bead = { x: box.x * CELL_SIZE_PX + (box.width * CELL_SIZE_PX) / 2, y: box.y * CELL_SIZE_PX + (box.height * CELL_SIZE_PX) / 2 }

  it('hits the bead its layout puts under the point, named by round and place, and puts it back there', () => {
    expect(view.pointToHit(bead)).toEqual({ row: 3, column: 5, layer: 'frame' })
    expect(view.beadToPoint({ row: 3, column: 5 }, 'frame')).toEqual({ x: bead.x, y: bead.y })
    expect(view.offShapeAt(bead)).toBe(false)
  })

  it('finds no bead Off-shape, and says so there and not off the Frame', () => {
    expect(view.pointToHit({ x: 2, y: 2 })).toBeUndefined()
    expect(view.offShapeAt({ x: 2, y: 2 })).toBe(true)
    expect(view.offShapeAt({ x: -40, y: -40 })).toBe(false)
  })

  it('gives the Select tool the Frame\'s cell under any point of it, on a bead or Off-shape, and none off it (ticket 0594)', () => {
    expect(view.frameCellAt({ x: 2, y: 2 })).toEqual({ row: 0, column: 0, layer: 'frame' })
    expect(view.frameCellAt(bead)).toEqual({ ...view.pointToCell(bead, 'frame'), layer: 'frame' })
    expect(view.frameCellAt({ x: -40, y: -40 })).toBeUndefined()
  })
})

describe('a Frame lying turned on the Canvas (ticket 0667)', () => {
  // A loom Frame of 4 rows and 6 columns, turned once: it lies 6 rows by 4 columns from its corner at (0, 0).
  const frame = { row: 0, column: 0, rows: 4, columns: 6, technique: 'loom' as const, quarterTurns: 1 as const }
  const view = surfaceView({ space: OPEN_SPACE, technique: 'loom', frame, rotation: 0, zoom: 1 })
  const at = (x: number, y: number) => ({ x: x * CELL_SIZE_PX, y: y * CELL_SIZE_PX })

  it('hits each bead where it lies turned, by its own row and column', () => {
    // Its first bead lies at the top right, its last at the bottom left.
    expect(view.pointToHit(at(3.5, 0.5))).toEqual({ row: 0, column: 0, layer: 'frame' })
    expect(view.pointToHit(at(0.5, 5.5))).toEqual({ row: 3, column: 5, layer: 'frame' })
    expect(view.beadToPoint({ row: 0, column: 0 }, 'frame')).toEqual(at(3.5, 0.5))
  })

  it('hides the Canvas under what it covers, and only there', () => {
    expect(view.pointToHit(at(3.5, 5.5))!.layer).toBe('frame')
    expect(view.pointToHit(at(4.5, 0.5))).toEqual({ row: 0, column: 4, layer: 'canvas' })
  })

  it('draws its line round what it covers, and gives the Select tool the cells under a point', () => {
    const line = view.frameBox(frame)
    expect(line.width).toBeLessThan(line.height)
    expect(view.frameCellAt(at(3.5, 5.5))).toEqual({ row: 5, column: 3, layer: 'frame' })
  })
})

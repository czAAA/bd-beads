import { FRAME_ID } from '../testUtils/frameId'
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { FrameRef, Rotation } from '../domain/grid'
import { columnCycle, type Technique } from '../domain/weave'
import { OPEN_SPACE, type Space } from './space'
import { CELL_SIZE_PX } from './cellSize'
import { projectExtentPx, surfaceView as viewOf } from './surfaceView'
import { seamOf } from './layerDrawings'
import { tiltedView } from './tiltedView'
import { customFrameSize, frameGeometry } from '../domain/frameShape'

/** The view, its Frame (when it has one) named `FRAME_ID` and drawn on its own surface, as every Frame is (spec 1234): the
 * way the Canvas is, its first position's corner at `at` (the Canvas place it is laid over, in grid px) unless a drawing is given. */
const surfaceView = (input: Parameters<typeof viewOf>[0] & { at?: { x: number; y: number } }) => {
  const { at = { x: 0, y: 0 }, ...view } = input
  const drawing = { rotation: view.rotation, scroll: view.scroll ?? { x: 0, y: 0 }, seam: { a: 1, b: 0, c: 0, d: 1, e: at.x, f: at.y } }
  return viewOf({ ...(view.frame ? { frameLayer: FRAME_ID, frameDrawing: drawing } : {}), ...view })
}

const TECHNIQUES: Technique[] = ['loom', 'peyote', 'brick']
/** After how many columns a Technique's stagger repeats: a move by that many keeps a bead's row on the screen. */
const columnCycleOf = (technique: Technique) => columnCycle({ technique })
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

    describe.each(ROTATIONS)('turned %i°', (rotation) => {
      it.each(VIEWS)('carries a position as many whole beads as the pointer went, wherever in its bead the press was (ticket 1150, zoom $zoom)', ({ zoom, scroll }) => {
        const view = surfaceView({ space: OPEN_SPACE, technique, rotation, zoom, scroll })
        const from = { row: 2, column: 2 }
        const { column: along, row: down } = view.beadStep()
        const middle = view.beadToPoint(from)
        // Pressed a third of a bead off the middle, each way: a staggered neighbour's bead is under the pointer there.
        for (const off of [-1 / 3, 1 / 3]) {
          const press = { x: middle.x + (along.x + down.x) * off, y: middle.y + (along.y + down.y) * off }
          const gone = (columns: number, rows: number) => ({ x: press.x + along.x * columns + down.x * rows, y: press.y + along.y * columns + down.y * rows })
          const pressed = view.pointToGrid(press)
          for (const [columns, rows] of [[0, 0], [1, 0], [3, 0], [0, 1], [0, -3], [-2, 5], [0.4, -0.4], [1.6, 0.6]] as const) {
            expect(view.carriedCell(from, pressed, gone(columns, rows))).toEqual({ row: 2 + Math.round(rows), column: 2 + Math.round(columns) })
          }
        }
      })

      it('carries it as far when the view has moved and zoomed since the press', () => {
        const pressedIn = surfaceView({ space: OPEN_SPACE, technique, rotation, zoom: 1 })
        const press = pressedIn.beadToPoint({ row: 2, column: 2 })
        const now = surfaceView({ space: OPEN_SPACE, technique, rotation, zoom: 2.5, scroll: { x: 37, y: -12 } })
        // The pointer is on a bead of the same row two stagger cycles on, as the view now draws it.
        expect(now.carriedCell({ row: 2, column: 2 }, pressedIn.pointToGrid(press), now.beadToPoint({ row: 2, column: 2 + 2 * columnCycleOf(technique) }))).toEqual({ row: 2, column: 2 + 2 * columnCycleOf(technique) })
      })
    })

    it('carries by whole stagger cycles when asked, half a cycle going the way of the drag (ticket 1150)', () => {
      const view = surfaceView({ space: OPEN_SPACE, technique, rotation: 0, zoom: 1 })
      const from = { row: 2, column: 2 }
      const press = view.beadToPoint(from)
      const { column: along, row: down } = view.beadStep()
      const carried = (columns: number, rows: number) => view.carriedCell(from, view.pointToGrid(press), { x: press.x + along.x * columns + down.x * rows, y: press.y + along.y * columns + down.y * rows }, undefined, true)
      // How far each goes, in beads, for the pointer gone 0.9, 1, 2.9, 3 and -1 beads that way.
      const went = { columns: [0.9, 1, 2.9, 3, -1].map((beads) => carried(beads, 0).column - 2), rows: [0.9, 1, 2.9, 3, -1].map((beads) => carried(0, beads).row - 2) }
      const byBeads = [1, 1, 3, 3, -1]
      const byPairs = [0, 2, 2, 4, -2]
      expect(went).toEqual({ columns: technique === 'peyote' ? byPairs : byBeads, rows: technique === 'brick' ? byPairs : byBeads })
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
    const view = surfaceView({ space: FRAME_ONLY('brick'), technique: 'brick', rotation: 0, zoom: 1 })
    // Row 1 is shifted half a bead right, so its first 10px has no bead; row 0 does not reach down that far at the middle of row 1.
    expect(view.pointToBead({ x: 5, y: view.beadToPoint({ row: 1, column: 0 }).y })).toBeUndefined()
    expect(view.pointToBead({ x: 15, y: view.beadToPoint({ row: 1, column: 0 }).y })).toEqual({ row: 1, column: 0 })
  })

  it('finds no bead in a half-bead gap above a shifted peyote column (ticket 0734)', () => {
    const view = surfaceView({ space: FRAME_ONLY('peyote'), technique: 'peyote', rotation: 0, zoom: 1 })
    // Column 1 is shifted half a bead down, so its first 10px has no bead.
    expect(view.pointToBead({ x: view.beadToPoint({ row: 0, column: 1 }).x, y: 5 })).toBeUndefined()
    expect(view.pointToBead({ x: view.beadToPoint({ row: 0, column: 1 }).x, y: 15 })).toEqual({ row: 0, column: 1 })
  })

  it('stacks brick stitch rows a bead apart, with no seam between them', () => {
    const view = surfaceView({ space: OPEN_SPACE, technique: 'brick', rotation: 0, zoom: 1 })
    expect(view.pointToBead({ x: 5, y: CELL_SIZE_PX - 0.5 })).toEqual({ row: 0, column: 0 })
    expect(view.pointToBead({ x: 5, y: CELL_SIZE_PX + 0.5 })).toEqual({ row: 1, column: -1 })
  })

  it('lays peyote\'s beads a full bead apart down a column, no bead over another (ticket 0734)', () => {
    const view = surfaceView({ space: OPEN_SPACE, technique: 'peyote', rotation: 0, zoom: 1 })
    // Column 1 starts at y = 10 and its first bead reaches to 30; row 1 of column 0 starts at 20.
    expect(view.pointToBead({ x: 30, y: 25 })).toEqual({ row: 0, column: 1 })
    expect(view.pointToBead({ x: 10, y: 25 })).toEqual({ row: 1, column: 0 })
  })

  it('shifts a layer’s rows or columns by their own number, its first always straight (ticket 492)', () => {
    const brick = surfaceView({ space: FRAME_ONLY('brick'), technique: 'brick', rotation: 0, zoom: 1 })
    expect(brick.beadToPoint({ row: 0, column: 0 })).toEqual({ x: 10, y: 10 })
    expect(brick.beadToPoint({ row: 1, column: 0 })).toEqual({ x: 20, y: 30 })
    const peyote = surfaceView({ space: FRAME_ONLY('peyote'), technique: 'peyote', rotation: 0, zoom: 1 })
    expect(peyote.beadToPoint({ row: 0, column: 0 })).toEqual({ x: 10, y: 10 })
    expect(peyote.beadToPoint({ row: 0, column: 1 })).toEqual({ x: 30, y: 20 })
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

  it('zooms in past 100% up to the most it is given (ticket 0964)', () => {
    const fit = (most: number) => open('loom', 0, 1, { viewport: { width: 1000, height: 1000 } }).zoomToFit(block, { width: 20, height: 20 }, undefined, most)
    expect(fit(1.5)).toBe(1.5)
    // 960px clear across 5 beads of 20px.
    expect(fit(100)).toBe(9.6)
  })

  it('counts an offset technique’s half bead in the width it fits', () => {
    const viewport = { width: 480, height: Infinity }
    const wide = { row: 0, column: 0, rows: 10, columns: 24 }
    expect(surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1, viewport }).zoomToFit(wide, { width: 0, height: 0 })).toBe(1)
    expect(surfaceView({ space: OPEN_SPACE, technique: 'brick', rotation: 0, zoom: 1, viewport }).zoomToFit(wide, { width: 0, height: 0 })).toBeLessThan(1)
  })
})

describe('the Surface view with a Frame woven in its own Technique (ticket 492)', () => {
  // A 4 × 4 brick stitch Frame laid over a loom Canvas, its first position's corner at (60, 40): its beads are counted from its own first.
  const frame = { technique: 'brick' as const, rows: 4, columns: 4 }
  const view = (extra = {}) => surfaceView({ space: OPEN_SPACE, technique: 'loom', frame, at: { x: 60, y: 40 }, rotation: 0, zoom: 1, ...extra })

  it('lays the Frame\'s beads out in its own Weave from its corner: row 1 shifted half a bead', () => {
    expect(view().beadToPoint({ row: 0, column: 0 }, FRAME_ID)).toEqual({ x: 70, y: 50 })
    expect(view().beadToPoint({ row: 1, column: 0 }, FRAME_ID)).toEqual({ x: 80, y: 70 })
  })

  it('lays the Canvas out in the Canvas\'s', () => {
    expect(view().beadToPoint({ row: 0, column: 0 })).toEqual({ x: 10, y: 10 })
    expect(view().beadToPoint({ row: 7, column: 8 })).toEqual({ x: 170, y: 150 })
  })

  it('says which bead of the Frame a point is on, by its own row and column', () => {
    expect(view().pointToBead({ x: 70, y: 50 })).toEqual({ row: 0, column: 0 })
    expect(view().pointToBead({ x: 80, y: 70 })).toEqual({ row: 1, column: 0 })
  })

  it('says which bead of the Canvas a point is on beside the Frame', () => {
    expect(view().pointToBead({ x: 10, y: 10 })).toEqual({ row: 0, column: 0 })
    expect(view().pointToBead({ x: 170, y: 150 })).toEqual({ row: 7, column: 8 })
  })

  it('says which layer a point is on', () => {
    expect(view().pointToHit({ x: 70, y: 40 + 55 })).toEqual({ row: 2, column: 0, layer: FRAME_ID })
    expect(view().pointToHit({ x: 10, y: 10 })).toEqual({ row: 0, column: 0, layer: 'canvas' })
  })

  it('measures a block of the Frame in the Frame\'s Weave and a block of the Canvas in the Canvas\'s', () => {
    expect(view().beadBox({ row: 0, column: 0, rows: 4, columns: 4 }, FRAME_ID)).toMatchObject({ x: 60, y: 40, width: 90, height: 80 })
    expect(view().beadBox({ row: 0, column: 0, rows: 2, columns: 2 })).toMatchObject({ x: 0, y: 0, width: 40, height: 40 })
  })

  it('finds the cell nearest a point in the geometry asked for', () => {
    expect(view().pointToCell({ x: 80, y: 70 }, FRAME_ID)).toEqual({ row: 1, column: 0 })
    expect(view().pointToCell({ x: 80, y: 65 }, 'canvas')).toEqual({ row: 3, column: 4 })
  })

  it('steps a layer by its own Weave', () => {
    expect(view().beadStep(FRAME_ID).row.y).toBe(20)
    expect(view().beadStep('canvas').row.y).toBe(20)
  })
})

describe('the Surface view with a Frame in a Bead half as wide as the Canvas\'s (ticket 0665)', () => {
  // A 4 × 4 loom Frame laid over a loom Canvas: its corner at (60, 40), each of its beads 10 px across.
  const frame = { technique: 'loom' as const, rows: 4, columns: 4, scale: 0.5 }
  const view = surfaceView({ space: OPEN_SPACE, technique: 'loom', frame, at: { x: 60, y: 40 }, rotation: 0, zoom: 1 })

  it('draws the Frame\'s beads at half the size from its corner, and finds each under its centre', () => {
    expect(view.beadToPoint({ row: 0, column: 0 }, FRAME_ID)).toEqual({ x: 65, y: 45 })
    expect(view.beadToPoint({ row: 3, column: 3 }, FRAME_ID)).toEqual({ x: 95, y: 75 })
    expect(view.pointToHit({ x: 95, y: 75 })).toEqual({ row: 3, column: 3, layer: FRAME_ID })
  })

  it('leaves the Canvas positions it does not reach to the Canvas, and covers only those it draws over', () => {
    expect(view.pointToHit({ x: 110, y: 50 })).toEqual({ row: 2, column: 5, layer: 'canvas' })
    expect(view.beadBox({ row: 0, column: 0, rows: 4, columns: 4 }, FRAME_ID)).toMatchObject({ x: 60, y: 40, width: 40, height: 40 })
    const line = view.frameBox({ row: 0, column: 0, ...frame })
    expect([line.x + line.width / 2, line.y + line.height / 2]).toEqual([80, 60])
  })

  it('steps the Frame by its own beads, and finds the cell nearest a point in them', () => {
    expect(view.beadStep(FRAME_ID).column.x).toBe(10)
    expect(view.beadStep('canvas').column.x).toBe(20)
    expect(view.pointToCell({ x: 96, y: 76 }, FRAME_ID)).toEqual({ row: 3, column: 3 })
  })
})

describe("A Bead's real cell finds beads where they are drawn (ADR 0068)", () => {
  const cell = { aspect: 1.6 / 1.3, roundness: 0.1 }
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
    const square = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1 }).beadStep().row
    expect(real.y).toBeCloseTo(CELL_SIZE_PX * cell.aspect)
    expect(square.y).toBe(CELL_SIZE_PX)
  })
})

describe('a Custom frame on the Canvas (ticket 0592)', () => {
  const frame = { ...customFrameSize('triangle', { rounds: 4 }), technique: 'peyote' as const, shape: 'triangle' as const, settings: { rounds: 4 } }
  const view = surfaceView({ space: OPEN_SPACE, technique: 'peyote', frame, rotation: 0, zoom: 1 })
  const { box } = frameGeometry(frame).place({ row: 3, column: 5 })!
  const bead = { x: box.x * CELL_SIZE_PX + (box.width * CELL_SIZE_PX) / 2, y: box.y * CELL_SIZE_PX + (box.height * CELL_SIZE_PX) / 2 }

  it('hits the bead its layout puts under the point, named by round and place, and puts it back there', () => {
    expect(view.pointToHit(bead)).toEqual({ row: 3, column: 5, layer: FRAME_ID })
    expect(view.beadToPoint({ row: 3, column: 5 }, FRAME_ID)).toEqual({ x: bead.x, y: bead.y })
    expect(view.offShapeAt(bead)).toBe(false)
  })

  it('finds no bead Off-shape, and says so there and not off the Frame', () => {
    expect(view.pointToHit({ x: 2, y: 2 })).toBeUndefined()
    expect(view.offShapeAt({ x: 2, y: 2 })).toBe(true)
    expect(view.offShapeAt({ x: -40, y: -40 })).toBe(false)
  })

  it('gives the Select tool the Frame\'s cell under any point of it, on a bead or Off-shape, and none off it (ticket 0594)', () => {
    expect(view.frameCellAt({ x: 2, y: 2 })).toEqual({ row: 0, column: 0, layer: FRAME_ID })
    expect(view.frameCellAt(bead)).toEqual({ ...view.pointToCell(bead, FRAME_ID), layer: FRAME_ID })
    expect(view.frameCellAt({ x: -40, y: -40 })).toBeUndefined()
  })
})

describe('a Frame lying turned on the Canvas (ticket 0667)', () => {
  // A loom Frame of 4 rows and 6 columns, turned once: it lies 6 rows by 4 columns from its corner at (0, 0).
  const frame = { rows: 4, columns: 6, technique: 'loom' as const, quarterTurns: 1 as const }
  const view = surfaceView({ space: OPEN_SPACE, technique: 'loom', frame, rotation: 0, zoom: 1 })
  const at = (x: number, y: number) => ({ x: x * CELL_SIZE_PX, y: y * CELL_SIZE_PX })

  it('hits each bead where it lies turned, by its own row and column', () => {
    // Its first bead lies at the top right, its last at the bottom left.
    expect(view.pointToHit(at(3.5, 0.5))).toEqual({ row: 0, column: 0, layer: FRAME_ID })
    expect(view.pointToHit(at(0.5, 5.5))).toEqual({ row: 3, column: 5, layer: FRAME_ID })
    expect(view.beadToPoint({ row: 0, column: 0 }, FRAME_ID)).toEqual(at(3.5, 0.5))
  })

  it('hides the Canvas under what it covers, and only there', () => {
    expect(view.pointToHit(at(3.5, 5.5))!.layer).toBe(FRAME_ID)
    expect(view.pointToHit(at(4.5, 0.5))).toEqual({ row: 0, column: 4, layer: 'canvas' })
  })

  it('draws its line round what it covers, and gives the Select tool the cells under a point', () => {
    const line = view.frameBox({ row: 0, column: 0, ...frame })
    expect(line.width).toBeLessThan(line.height)
    expect(view.frameCellAt(at(3.5, 5.5))).toEqual({ row: 5, column: 3, layer: FRAME_ID })
  })
})

describe('the Frame layer by its own transform (ticket 1187)', () => {
  // A 4 × 4 loom Frame over a loom Canvas, its sheet drawn on a surface of its own.
  const frame = { technique: 'loom' as const, rows: 4, columns: 4 }
  const screen = { width: 400, height: 300 }
  const base = { space: OPEN_SPACE, technique: 'loom' as const, frame, zoom: 1.5, scroll: { x: -40, y: 25 } }
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

  it('lies exactly where the Canvas lays the same positions when its surface is drawn as the Canvas is', () => {
    // Its first position's corner on the Canvas position (2, 3), at (60, 40) in grid px.
    for (const rotation of ROTATIONS) {
      const canvas = surfaceView({ ...base, frame: undefined, rotation })
      // The seam's translation is in displayed space, which is the viewport's plus the scroll.
      const seam = canvas.gridToPoint(3 * CELL_SIZE_PX, 2 * CELL_SIZE_PX)
      const own = surfaceView({ ...base, rotation, frameDrawing: { rotation, scroll: base.scroll, seam: { ...identity, e: seam.x + base.scroll.x, f: seam.y + base.scroll.y } } })
      for (const bead of [{ row: 0, column: 0 }, { row: 3, column: 3 }, { row: 2, column: 1 }]) {
        const [a, b] = [canvas.beadToPoint({ row: bead.row + 2, column: bead.column + 3 }), own.beadToPoint(bead, FRAME_ID)]
        expect(b.x).toBeCloseTo(a.x, 9)
        expect(b.y).toBeCloseTo(a.y, 9)
        expect(own.pointToHit(a)).toEqual({ ...bead, layer: FRAME_ID })
      }
    }
  })

  describe.each([
    { name: 'an upright Frame over a Canvas at 37°', canvas: 37, frame: 0 },
    { name: 'a Frame at 37° over an upright Canvas', canvas: 0, frame: 37 },
  ])('$name', ({ canvas, frame: frameAngle }) => {
    const canvasLean = tiltedView(screen, canvas)
    const frameLean = tiltedView(screen, frameAngle)
    const view = surfaceView({ ...base, rotation: 0, frameDrawing: { rotation: 0, scroll: { x: 10, y: -30 }, seam: seamOf(frameLean, canvasLean) } })
    /** A point of the Frame's own drawing, among the Canvas drawing's points. */
    const fromFrameDrawing = (point: { x: number; y: number }) => canvasLean.toDrawn(frameLean.toScreen(point))
    const frameOnly = surfaceView({ ...base, rotation: 0, scroll: { x: 10, y: -30 } })

    it('finds each Frame bead where its own drawing puts it, and back', () => {
      for (const bead of [{ row: 0, column: 0 }, { row: 3, column: 3 }, { row: 1, column: 2 }]) {
        const at = fromFrameDrawing(frameOnly.beadToPoint(bead, FRAME_ID))
        const point = view.beadToPoint(bead, FRAME_ID)
        expect(point.x).toBeCloseTo(at.x, 9)
        expect(point.y).toBeCloseTo(at.y, 9)
        expect(view.pointToHit(point)).toEqual({ ...bead, layer: FRAME_ID })
        expect(view.pointToCell(point, FRAME_ID)).toEqual(bead)
      }
    })

    it('keeps the Canvas under it as the Canvas lies', () => {
      const plain = surfaceView({ ...base, rotation: 0 })
      expect(view.beadToPoint({ row: 20, column: 20 })).toEqual(plain.beadToPoint({ row: 20, column: 20 }))
      expect(view.pointToHit(plain.beadToPoint({ row: 20, column: 20 }))).toEqual({ row: 20, column: 20, layer: 'canvas' })
    })

    it('is opaque: a point on the Frame is never the Canvas bead under it', () => {
      const middle = view.beadToPoint({ row: 1, column: 1 }, FRAME_ID)
      expect(view.pointToHit(middle)?.layer).toBe(FRAME_ID)
    })

    it('boxes the Frame round its turned corners and steps it along its own rows', () => {
      const box = view.frameBox({ row: 0, column: 0, ...frame })
      for (const corner of [{ row: 0, column: 0 }, { row: 3, column: 3 }]) {
        const at = view.beadToPoint(corner, FRAME_ID)
        expect(at.x).toBeGreaterThan(box.x)
        expect(at.x).toBeLessThan(box.x + box.width)
        expect(at.y).toBeGreaterThan(box.y)
        expect(at.y).toBeLessThan(box.y + box.height)
      }
      const step = view.beadStep(FRAME_ID).column
      expect(Math.hypot(step.x, step.y)).toBeCloseTo(CELL_SIZE_PX * base.zoom, 9)
      expect(Math.atan2(step.y, step.x) * (180 / Math.PI)).toBeCloseTo(frameAngle - canvas, 6)
    })

    it('carries a Frame drag by how far the pointer went along its own rows', () => {
      const from = { row: 0, column: 0 }
      const pressed = view.beadToPoint(from, FRAME_ID)
      const step = view.beadStep(FRAME_ID)
      const point = { x: pressed.x + 2 * step.column.x + step.row.x, y: pressed.y + 2 * step.column.y + step.row.y }
      expect(view.carriedCell(from, view.pointToGrid(pressed), point, FRAME_ID)).toEqual({ row: 1, column: 2 })
    })

    describe('its margin sheet (tickets 1188, 1237)', () => {
      // Its margin sheet two beads round it, in its own drawing's grid px; what it covers is what is drawn under it, so a
      // Canvas position is the Canvas's wherever the Frame does not lie on screen.
      const sheet = { x: -2 * CELL_SIZE_PX, y: -2 * CELL_SIZE_PX, width: 8 * CELL_SIZE_PX, height: 8 * CELL_SIZE_PX }
      const drawing = { rotation: 0 as const, scroll: { x: 10, y: -30 }, seam: seamOf(frameLean, canvasLean), sheet }
      const away = surfaceView({ ...base, rotation: 0, frameDrawing: { ...drawing, scroll: { x: 900, y: 900 } } })
      const off = surfaceView({ ...base, rotation: 0, frameDrawing: drawing })
      const plain = surfaceView({ ...base, rotation: 0 })

      it('leaves the Canvas positions to the Canvas where the Frame does not lie on screen', () => {
        const under = plain.beadToPoint({ row: 3, column: 4 })
        expect(away.pointToHit(under)).toEqual({ row: 3, column: 4, layer: 'canvas' })
        expect(away.onMarginSheet(under)).toBe(false)
      })

      it('takes no press on its margin sheet, at any angle, and the Frame\'s beads inside it', () => {
        const corner = off.beadToPoint({ row: 0, column: 0 }, FRAME_ID)
        const step = off.beadStep(FRAME_ID)
        const beside = { x: corner.x - step.column.x - 0.2 * step.row.x, y: corner.y - step.column.y - 0.2 * step.row.y }
        expect(off.onMarginSheet(beside)).toBe(true)
        expect(off.pointToHit(beside)).toBeUndefined()
        expect(off.onMarginSheet(corner)).toBe(false)
        expect(off.pointToHit(corner)).toEqual({ row: 0, column: 0, layer: FRAME_ID })
      })
    })
  })
})

describe('several Frames in one view (ticket 1219)', () => {
  // The first 4 × 4 loom Frame; a second, peyote, drawn leaning on its own.
  const first = { technique: 'loom' as const, rows: 4, columns: 4 }
  const second = { technique: 'peyote' as const, rows: 4, columns: 4 }
  const SECOND = 'second' as FrameRef
  const screen = { width: 400, height: 300 }
  const base = { space: OPEN_SPACE, technique: 'loom' as const, frame: first, zoom: 1.5, scroll: { x: -40, y: 25 }, rotation: 0 as const }
  const lean = tiltedView(screen, 20)
  const drawing = { rotation: 0 as const, scroll: { x: 10, y: -30 }, seam: seamOf(lean, tiltedView(screen, 0)) }
  const view = surfaceView({ ...base, others: [{ frame: second, frameLayer: SECOND, frameDrawing: drawing }] })
  const alone = surfaceView({ ...base, frame: second, frameLayer: SECOND, frameDrawing: drawing })

  it('hits each Frame\'s beads as that Frame, the second where its own drawing lays it', () => {
    expect(view.pointToHit(view.beadToPoint({ row: 1, column: 1 }, FRAME_ID))).toEqual({ row: 1, column: 1, layer: FRAME_ID })
    for (const bead of [{ row: 0, column: 0 }, { row: 2, column: 1 }]) {
      const point = view.beadToPoint(bead, SECOND)
      expect(point).toEqual(alone.beadToPoint(bead, SECOND))
      expect(view.pointToHit(point)).toEqual({ ...bead, layer: SECOND })
      expect(view.pointToCell(point, SECOND)).toEqual(bead)
    }
  })

  it('keeps the Canvas between them the Canvas\'s', () => {
    expect(view.pointToHit(view.beadToPoint({ row: 12, column: 12 }))).toEqual({ row: 12, column: 12, layer: 'canvas' })
  })
})

describe('a peyote Frame\'s empty half beads (ticket 1196)', () => {
  const frame = { rows: 4, columns: 4, technique: 'peyote' as const }
  const view = surfaceView({ space: OPEN_SPACE, technique: 'peyote', frame, rotation: 0, zoom: 1 })
  const cell = (column: number, y: number) => ({ x: (column + 0.5) * CELL_SIZE_PX, y: y * CELL_SIZE_PX })

  it('says a point in the half bead at the end of a staggered column holds no bead, and a point in a bead does', () => {
    // Column 1 sits half a bead down: the half bead above it is off the shape, and the half bead below column 0.
    expect(view.offShapeAt(cell(1, 0.25))).toBe(true)
    expect(view.offShapeAt(cell(0, 4.25))).toBe(true)
    expect(view.offShapeAt(cell(1, 1.0))).toBe(false)
    expect(view.offShapeAt(cell(0, 0.25))).toBe(false)
  })

  it('says it of no point off the Frame', () => {
    expect(view.offShapeAt({ x: -40, y: -40 })).toBe(false)
  })
})

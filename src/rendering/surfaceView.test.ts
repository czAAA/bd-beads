// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Rotation, Technique } from '../domain/grid'
import { OPEN_SPACE, type Space } from './space'
import { CELL_SIZE_PX, projectExtentPx, surfaceView } from './surfaceView'

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

    it('gives no bead for a point outside a Project drawn on its own, and the nearest cell for one on the open canvas', () => {
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

  it('finds no bead on the 1px seam between two brick stitch rows', () => {
    const view = surfaceView({ space: OPEN_SPACE, technique: 'brick', rotation: 0, zoom: 1 })
    expect(view.pointToBead({ x: 5, y: CELL_SIZE_PX - 0.5 })).toEqual({ row: 0, column: 0 })
    expect(view.pointToBead({ x: 5, y: CELL_SIZE_PX + 0.5 })).toBeUndefined()
    expect(view.pointToBead({ x: 5, y: CELL_SIZE_PX + 1.5 })).toEqual({ row: 1, column: -1 })
  })

  it('gives the overlap of two nested peyote rows to the one drawn later, but not in its rounded corner', () => {
    const view = surfaceView({ space: OPEN_SPACE, technique: 'peyote', rotation: 0, zoom: 1 })
    // Row 1 starts at y = 15 and row 0 reaches to 20: the overlap is row 1's, except where its corner is cut away.
    expect(view.pointToBead({ x: 20, y: 17 })).toEqual({ row: 1, column: 0 })
    expect(view.pointToBead({ x: 10.5, y: 15.2 })).toEqual({ row: 0, column: 0 })
  })

  it('keeps the parity of the Project’s own row in a space that starts on an odd one', () => {
    const odd: Space = { ...FRAME_ONLY('peyote'), toAbsolute: { row: 1, column: 0 } }
    const view = surfaceView({ space: odd, technique: 'peyote', rotation: 0, zoom: 1 })
    expect(view.beadToPoint({ row: 0, column: 0 })).toEqual({ x: 20, y: 10 })
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
    expect(open('brick', 0).beadStep().row).toEqual({ x: 0, y: 21 })
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

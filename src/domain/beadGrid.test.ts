import { describe, expect, it } from 'vitest'
import { beadGridPart, detectBeadGrid, onBeadGrid } from './beadGrid'
import { beadPhoto, drawPicture, type Rgb } from '../testUtils/beadPhoto'

// The bead grid of a photo of beadwork (ticket 0772): found on rings with holes that repeat, and on nothing else.

const BEADS: Rgb[] = [
  [230, 230, 220],
  [60, 40, 30],
  [120, 170, 220],
  [150, 110, 80],
]
const mixed = (column: number, row: number) => BEADS[(row * 3 + column * 5 + Math.floor(column / 4)) % BEADS.length]!

describe('detectBeadGrid (ticket 0772)', () => {
  it('finds the pitch, the offset and the count of beads in a photo of beadwork', () => {
    const grid = detectBeadGrid(beadPhoto(24, 20, 18, 15, mixed))!

    expect(grid).toBeDefined()
    expect(grid.pitch.x).toBeCloseTo(18, 0)
    expect(grid.pitch.y).toBeCloseTo(18, 0)
    // The first whole cell begins at the margin, or whole beads in, to within a pixel or so: never on a bead's middle.
    const offBoundary = (at: number) => {
      const d = (((at - 15) % 18) + 18) % 18
      return Math.min(d, 18 - d)
    }
    expect(offBoundary(grid.origin.x)).toBeLessThan(1.5)
    expect(offBoundary(grid.origin.y)).toBeLessThan(1.5)
    expect(grid.columns).toBeGreaterThanOrEqual(23)
    expect(grid.rows).toBeGreaterThanOrEqual(19)
  })

  it('finds the grid of a big photo too, read on a smaller copy', () => {
    const grid = detectBeadGrid(beadPhoto(30, 24, 36, 30, mixed))!

    expect(grid).toBeDefined()
    expect(grid.pitch.x).toBeCloseTo(36, -1)
    expect(grid.columns).toBeGreaterThanOrEqual(29)
  })

  it('finds no grid in pixel art, which is flat', () => {
    const picture = drawPicture(240, 240, (x, y) => BEADS[(Math.floor(x / 12) * 7 + Math.floor(y / 12) * 3) % BEADS.length]!, 0)

    expect(detectBeadGrid(picture)).toBeUndefined()
  })

  it('finds no grid in a photo with nothing that repeats', () => {
    const picture = drawPicture(300, 200, (x, y) => [100 + Math.round(x / 3), 120 + Math.round(y / 4), 80 + Math.round((x + y) / 8)], 20)

    expect(detectBeadGrid(picture)).toBeUndefined()
  })

  it('finds no grid in noise', () => {
    const picture = drawPicture(200, 200, () => [128, 128, 128], 60)

    expect(detectBeadGrid(picture)).toBeUndefined()
  })
})

describe('beadGridPart and onBeadGrid (ticket 0772)', () => {
  const grid = { pitch: { x: 16.92, y: 16.7 }, origin: { x: 8.4, y: 13.6 }, columns: 25, rows: 26 }
  const image = { width: 436, height: 460 }

  it('is the grid’s whole cells in whole pixels, cut to the picture', () => {
    expect(beadGridPart(grid, image)).toEqual({ x: 8, y: 14, width: 423, height: 434 })
    expect(beadGridPart({ ...grid, columns: 40 }, image)).toEqual({ x: 8, y: 14, width: 428, height: 434 })
  })

  it('says whether a part with a Schema’s dimensions lies on the grid', () => {
    const part = beadGridPart(grid, image)

    expect(onBeadGrid(grid, part, { columns: 25, rows: 26 }, image)).toBe(true)
    expect(onBeadGrid(grid, part, { columns: 26, rows: 26 }, image)).toBe(false)
    expect(onBeadGrid(grid, part, { columns: 25, rows: 27 }, image)).toBe(false)
    expect(onBeadGrid(grid, { ...part, x: part.x + 1 }, { columns: 25, rows: 26 }, image)).toBe(false)
  })
})

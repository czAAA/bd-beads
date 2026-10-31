// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PREVIEW_MAX_CELLS, partLattice } from './imageFraming'

describe('partLattice (the preview round the part)', () => {
  const square = { x: 1, y: 1 }

  it('is just the frame for the whole picture, with nothing around it to show', () => {
    const image = { width: 50, height: 50 }
    expect(partLattice({ image, part: { x: 0, y: 0, ...image }, pixelsPerBead: { x: 5, y: 5 }, dimensions: { columns: 10, rows: 10 }, technique: 'loom' })).toEqual({
      columns: 10,
      rows: 10,
      frameColumn: 0,
      frameRow: 0,
    })
  })

  it('draws the rest of the picture round a part in whole beads, a part bead at the edge counting as one', () => {
    const image = { width: 8, height: 8 }
    const lattice = partLattice({ image, part: { x: 2, y: 2, width: 4, height: 4 }, pixelsPerBead: { x: 2, y: 2 }, dimensions: { columns: 2, rows: 2 }, technique: 'loom' })
    // The rows above are whole cycles of the shift, so the top reaches a row past the picture.
    expect(lattice).toEqual({ columns: 4, rows: 5, frameColumn: 1, frameRow: 2 })
  })

  it('counts the surround in each side’s own pixels per bead', () => {
    const image = { width: 200, height: 100 }
    const lattice = partLattice({ image, part: { x: 20, y: 10, width: 160, height: 80 }, pixelsPerBead: { x: 5, y: 6.25 }, dimensions: { columns: 32, rows: 13 }, technique: 'loom' })
    expect(lattice.frameColumn).toBe(4)
    expect(lattice.columns).toBe(4 + 32 + 4)
    expect(lattice.frameRow).toBe(2)
    expect(lattice.rows).toBe(2 + 13 + 2)
  })

  it('keeps the frame on a multiple of 2N rows with a Drop of N (ticket 477)', () => {
    const image = { width: 50, height: 400 }
    const lattice = partLattice({
      image,
      part: { x: 0, y: 180, width: 50, height: 50 },
      pixelsPerBead: square,
      dimensions: { columns: 50, rows: 50 },
      technique: 'brick',
      techniqueSettings: { brickDrop: 3 },
    })
    expect(lattice.frameRow).toBeGreaterThan(0)
    expect(lattice.frameRow % 6).toBe(0)
  })

  it('keeps the frame’s own row parity, so an offset technique’s stagger lines up across the frame edge', () => {
    const image = { width: 50, height: 400 }
    const lattice = partLattice({ image, part: { x: 0, y: 175, width: 50, height: 50 }, pixelsPerBead: square, dimensions: { columns: 50, rows: 50 }, technique: 'peyote' })
    expect(lattice.frameRow).toBeGreaterThan(0)
    expect(lattice.frameRow % 2).toBe(0)
  })

  it('stays inside the cell budget however much picture lies round the part', () => {
    const image = { width: 4000, height: 4000 }
    // An ordinary big Project (60 x 90, the size ADR 0009 measures against), whose own cells are well inside the
    // budget — so what the budget has to trim here is the surround, not the frame.
    const big = { columns: 60, rows: 90 }
    const lattice = partLattice({ image, part: { x: 1970, y: 1955, width: 60, height: 90 }, pixelsPerBead: square, dimensions: big, technique: 'loom' })

    expect(lattice.columns * lattice.rows).toBeLessThanOrEqual(PREVIEW_MAX_CELLS)
    expect(lattice.columns).toBeGreaterThanOrEqual(big.columns)
    expect(lattice.rows).toBeGreaterThanOrEqual(big.rows)
  })

  it('still renders the frame itself when the Project alone is past the budget', () => {
    const image = { width: 4000, height: 4000 }
    const enormous = { columns: 400, rows: 400 }
    const lattice = partLattice({ image, part: { x: 1800, y: 1800, width: 400, height: 400 }, pixelsPerBead: square, dimensions: enormous, technique: 'loom' })

    expect(lattice).toEqual({ columns: 400, rows: 400, frameColumn: 0, frameRow: 0 })
  })
})

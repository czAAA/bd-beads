import { describe, expect, it } from 'vitest'
import { outlineOf, type LiftBody } from './liftedOutline'

const cell = (column: number, row: number): LiftBody => ({ x: column * 20 + 0.5, y: row * 20 + 0.5, width: 19, height: 19 })
const area = (loop: readonly (readonly [number, number])[]) => loop.reduce((sum, [x, y], at) => sum + (x * loop[(at + 1) % loop.length]![1] - loop[(at + 1) % loop.length]![0] * y), 0) / 2

describe('outlineOf (ticket 1177)', () => {
  it('is one grown rectangle round a single bead', () => {
    const outline = outlineOf([cell(0, 0)], 4)!
    expect(outline.loops).toHaveLength(1)
    expect(outline.loops[0]).toHaveLength(4)
    expect(area(outline.loops[0]!)).toBeCloseTo(27 * 27)
  })

  it('traces clockwise on the screen, so the shape is on the right of each edge', () => {
    const [first, second] = outlineOf([cell(0, 0)], 4)!.loops[0]!
    expect(first![0]).toBeLessThan(second![0])
  })

  it('joins beads side by side and closes a gap under twice the reach', () => {
    const touching = outlineOf([cell(0, 0), cell(1, 0)], 4)!
    expect(touching.loops).toHaveLength(1)
    const near = outlineOf([{ ...cell(0, 0), width: 15 }, { ...cell(1, 0), x: 20.5 }], 4)!
    expect(near.loops).toHaveLength(1)
    const far = outlineOf([cell(0, 0), cell(2, 0)], 4)!
    expect(far.loops).toHaveLength(2)
  })

  it('fills a hole the beads close in, whatever its size, and keeps a bite that opens outward', () => {
    const ring = [0, 1, 2, 3, 4].flatMap((row) => [0, 1, 2, 3, 4].filter((column) => row === 0 || row === 4 || column === 0 || column === 4).map((column) => cell(column, row)))
    const closed = outlineOf(ring, 4)!
    expect(closed.loops).toHaveLength(1)
    expect(closed.covers(50, 50)).toBe(true)
    const bitten = outlineOf(ring.filter((body) => !(body.x === 40.5 && body.y === 0.5)), 4)!
    expect(bitten.covers(50, 10)).toBe(false)
    expect(bitten.loops[0]!.length).toBeGreaterThan(4)
  })

  it('covers a point inside the shape and none outside', () => {
    const outline = outlineOf([cell(0, 0)], 4)!
    expect(outline.covers(10, 10)).toBe(true)
    expect(outline.covers(-3, 10)).toBe(true)
    expect(outline.covers(-5, 10)).toBe(false)
    expect(outline.covers(40, 10)).toBe(false)
  })

  it('says whether a bead added changes nothing of the outline', () => {
    const block = [0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => cell(column, row)))
    const outline = outlineOf(block.filter((body) => !(body.x === 20.5 && body.y === 20.5)), 4)!
    expect(outline.holds(cell(1, 1))).toBe(true)
    expect(outline.holds(cell(3, 1))).toBe(false)
  })

  it('has no outline for no bead', () => {
    expect(outlineOf([], 4)).toBeNull()
  })
})

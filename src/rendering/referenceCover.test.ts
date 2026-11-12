// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { pictureCover } from './referenceCover'
import type { Weave } from '../domain/weave'

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

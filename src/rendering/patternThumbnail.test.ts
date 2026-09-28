import { describe, expect, it } from 'vitest'
import { thumbnailPixels } from './patternThumbnail'
import type { Rotation } from '../domain/grid'
import type { Pattern } from '../domain/pattern'

function pattern(grid: (string | null)[][], rotation: Rotation = 0): Pattern {
  return {
    id: 'p',
    name: 'P',
    technique: 'loom',
    beadId: 'toho-cube-1.5mm',
    columns: grid[0]!.length,
    rows: grid.length,
    grid: grid.map((row) => row.map((color) => ({ color }))),
    rowProgress: { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 },
    rotation,
    createdAt: 0,
    updatedAt: 0,
  }
}

const RED = [255, 0, 0, 255]
const BLUE = [0, 0, 255, 255]
const NONE = [0, 0, 0, 0]
const pixel = (image: ReturnType<typeof thumbnailPixels>, x: number, y: number) =>
  [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)]

describe('thumbnailPixels', () => {
  it('fits the whole Pattern into the size with square beads, the longer side filling it', () => {
    const image = thumbnailPixels(pattern([['#ff0000', '#0000ff']]), 8)

    expect([image.width, image.height]).toEqual([8, 4])
    expect(pixel(image, 0, 0)).toEqual(RED)
    expect(pixel(image, 3, 3)).toEqual(RED)
    expect(pixel(image, 4, 0)).toEqual(BLUE)
  })

  it('leaves empty beads clear, for the board behind to show', () => {
    const image = thumbnailPixels(pattern([[null, '#ff0000']]), 2)

    expect(pixel(image, 0, 0)).toEqual(NONE)
    expect(pixel(image, 1, 0)).toEqual(RED)
  })

  it('samples a Pattern bigger than the size, never drawing more pixels than it', () => {
    const big = pattern(Array.from({ length: 300 }, () => Array.from({ length: 200 }, () => '#0000ff')))
    const image = thumbnailPixels(big, 72)

    expect([image.width, image.height]).toEqual([48, 72])
    expect(pixel(image, 47, 71)).toEqual(BLUE)
  })

  it('never draws a small Pattern bigger than one pixel per bead times the size', () => {
    expect(thumbnailPixels(pattern([['#ff0000']]), 72).width).toBe(72)
  })

  it('turns a rotated Pattern the way it shows on screen, a quarter clockwise', () => {
    // Grid rows: [R, B]. Turned clockwise, it stands as R over B.
    const image = thumbnailPixels(pattern([['#ff0000', '#0000ff']], 90), 2)

    expect([image.width, image.height]).toEqual([1, 2])
    expect(pixel(image, 0, 0)).toEqual(RED)
    expect(pixel(image, 0, 1)).toEqual(BLUE)
  })

  it('turns a rotated Pattern upside down (180°, ticket 171)', () => {
    // Grid rows: [R, B]. Upside down, it reads B then R, still one row.
    const image = thumbnailPixels(pattern([['#ff0000', '#0000ff']], 180), 2)

    expect([image.width, image.height]).toEqual([2, 1])
    expect(pixel(image, 0, 0)).toEqual(BLUE)
    expect(pixel(image, 1, 0)).toEqual(RED)
  })

  it('turns a rotated Pattern a quarter counterclockwise (270°, ticket 171)', () => {
    // Grid rows: [R, B]. Turned the other way, it stands as B over R -- the mirror of the 90° case.
    const image = thumbnailPixels(pattern([['#ff0000', '#0000ff']], 270), 2)

    expect([image.width, image.height]).toEqual([1, 2])
    expect(pixel(image, 0, 0)).toEqual(BLUE)
    expect(pixel(image, 0, 1)).toEqual(RED)
  })
})

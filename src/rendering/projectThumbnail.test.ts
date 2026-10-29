import { describe, expect, it } from 'vitest'
import { thumbnailPixels } from './projectThumbnail'
import type { Rotation } from '../domain/grid'
import { defaultPaletteIds } from '../domain/palette'
import { framedGrid } from '../domain/layerBeads'
import type { Project } from '../domain/project'
import type { Technique } from '../domain/weave'
import { changeFrame } from '../domain/changeFrame'
import { rotateFrame } from '../domain/rotate'
import { frameGeometryOf, onLayer } from '../domain/layers'
import { paintCells } from '../domain/drawing'
import { withFrameSheet } from '../domain/layerRecord'
import { withFields } from '../testUtils/flatFields'

function project(grid: (string | null)[][], rotation: Rotation = 0, technique: Technique = 'loom'): Project {
  const { layers } = framedGrid(
    grid.map((row) => row.map((color) => ({ color }))),
    { technique, beadId: 'toho-cube-1.5mm' },
  )
  return withFields({ id: 'p', layers, palette: defaultPaletteIds(), createdAt: 0, updatedAt: 0 }, { name: 'P', rotation })
}

const RED = [255, 0, 0, 255]
const BLUE = [0, 0, 255, 255]
const NONE = [0, 0, 0, 0]
const pixel = (image: ReturnType<typeof thumbnailPixels>, x: number, y: number) =>
  [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)]

describe('thumbnailPixels', () => {
  it('fits the whole Project into the size with square beads, the longer side filling it', () => {
    const image = thumbnailPixels(project([['#ff0000', '#0000ff']]), 8)

    expect([image.width, image.height]).toEqual([8, 4])
    expect(pixel(image, 0, 0)).toEqual(RED)
    expect(pixel(image, 3, 3)).toEqual(RED)
    expect(pixel(image, 4, 0)).toEqual(BLUE)
  })

  it('leaves empty beads clear, for the board behind to show', () => {
    const image = thumbnailPixels(project([[null, '#ff0000']]), 2)

    expect(pixel(image, 0, 0)).toEqual(NONE)
    expect(pixel(image, 1, 0)).toEqual(RED)
  })

  it('samples a Project bigger than the size, never drawing more pixels than it', () => {
    const big = project(Array.from({ length: 300 }, () => Array.from({ length: 200 }, () => '#0000ff')))
    const image = thumbnailPixels(big, 72)

    expect([image.width, image.height]).toEqual([48, 72])
    expect(pixel(image, 47, 71)).toEqual(BLUE)
  })

  it('never draws a small Project bigger than one pixel per bead times the size', () => {
    expect(thumbnailPixels(project([['#ff0000']]), 72).width).toBe(72)
  })

  it('turns a rotated Project the way it shows on screen, a quarter clockwise', () => {
    // Grid rows: [R, B]. Turned clockwise, it stands as R over B.
    const image = thumbnailPixels(project([['#ff0000', '#0000ff']], 90), 2)

    expect([image.width, image.height]).toEqual([1, 2])
    expect(pixel(image, 0, 0)).toEqual(RED)
    expect(pixel(image, 0, 1)).toEqual(BLUE)
  })

  it('turns a rotated Project upside down (180°, ticket 171)', () => {
    // Grid rows: [R, B]. Upside down, it reads B then R, still one row.
    const image = thumbnailPixels(project([['#ff0000', '#0000ff']], 180), 2)

    expect([image.width, image.height]).toEqual([2, 1])
    expect(pixel(image, 0, 0)).toEqual(BLUE)
    expect(pixel(image, 1, 0)).toEqual(RED)
  })

  it('turns a rotated Project a quarter counterclockwise (270°, ticket 171)', () => {
    // Grid rows: [R, B]. Turned the other way, it stands as B over R -- the mirror of the 90° case.
    const image = thumbnailPixels(project([['#ff0000', '#0000ff']], 270), 2)

    expect([image.width, image.height]).toEqual([1, 2])
    expect(pixel(image, 0, 0)).toEqual(BLUE)
    expect(pixel(image, 0, 1)).toEqual(RED)
  })

  // Peyote's and brick stitch's every other row lies half a bead to the right, as the editor draws it (ticket 0631).
  it("shifts peyote's every other row half a bead, its rows nesting", () => {
    // Beads 4 px wide: a peyote row nests a quarter into the one above, so two rows stand 7 px, not 8.
    const image = thumbnailPixels(project([['#ff0000', '#ff0000'], ['#0000ff', '#0000ff']], 0, 'peyote'), 10)

    expect([image.width, image.height]).toEqual([10, 7])
    expect(pixel(image, 0, 6)).toEqual(NONE)
    expect(pixel(image, 2, 6)).toEqual(BLUE)
    expect(pixel(image, 9, 0)).toEqual(NONE)
    expect(pixel(image, 9, 6)).toEqual(BLUE)
  })

  it("shifts brick stitch's every other row half a bead", () => {
    const image = thumbnailPixels(project([['#ff0000', '#ff0000'], ['#0000ff', '#0000ff']], 0, 'brick'), 10)

    expect([image.width, image.height]).toEqual([10, 8])
    expect(pixel(image, 0, 5)).toEqual(NONE)
    expect(pixel(image, 2, 5)).toEqual(BLUE)
    expect(pixel(image, 9, 1)).toEqual(NONE)
    expect(pixel(image, 9, 5)).toEqual(BLUE)
  })

  it('turns a shifted row with the Project', () => {
    // Upside down, the shifted row is on top and lies half a bead to the left.
    const image = thumbnailPixels(project([['#ff0000', '#ff0000'], ['#0000ff', '#0000ff']], 180, 'brick'), 10)

    expect(pixel(image, 0, 1)).toEqual(BLUE)
    expect(pixel(image, 9, 1)).toEqual(NONE)
    expect(pixel(image, 0, 5)).toEqual(NONE)
  })

  it('draws a Frame turned by Rotate Frame as it lies: its first row down the right side (ticket 0667)', () => {
    const upright = project([['#ff0000', '#ff0000', '#ff0000', '#ff0000'], ['#0000ff', '#0000ff', '#0000ff', '#0000ff']])
    const image = thumbnailPixels(rotateFrame(upright)!, 8)

    expect([image.width, image.height]).toEqual([4, 8])
    expect(pixel(image, 3, 1)).toEqual(RED)
    expect(pixel(image, 0, 6)).toEqual(BLUE)
  })

  /** A small Custom frame Triangle, every bead red, and its Layer geometry. */
  function redTriangle(rotation: Rotation = 0) {
    const open = withFrameSheet(project([[null]], rotation), undefined)
    const placed = changeFrame(open, { custom: { shape: 'triangle', size: 3, centre: { row: 8, column: 10 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
    const geometry = frameGeometryOf(placed.project)
    return { geometry, triangle: onLayer(placed.project, 'frame', (view) => paintCells(view, [...geometry.positions()], '#ff0000')) }
  }

  it('draws a Custom frame in its shape, each bead where the Frame lays it and the Off-shape clear', () => {
    const { geometry, triangle } = redTriangle()
    const size = 72
    const image = thumbnailPixels(triangle, size)
    const extent = geometry.extent()!
    const scale = size / Math.max(extent.width, extent.height)

    expect(image.width).toBe(Math.round(extent.width * scale))
    for (const position of geometry.positions()) {
      const { box } = geometry.place(position)!
      expect(pixel(image, Math.floor((box.x + box.width / 2) * scale), Math.floor((box.y + box.height / 2) * scale))).toEqual(RED)
    }
    // The triangle stands on its base: its top corners are Off-shape.
    expect(pixel(image, 0, 0)).toEqual(NONE)
    expect(pixel(image, image.width - 1, 0)).toEqual(NONE)
  })

  it('turns a Custom frame with the Project', () => {
    const { geometry, triangle } = redTriangle(180)
    const size = 72
    const image = thumbnailPixels(triangle, size)
    const extent = geometry.extent()!
    const scale = size / Math.max(extent.width, extent.height)

    for (const position of geometry.positions()) {
      const { box } = geometry.place(position)!
      const [x, y] = [extent.width - (box.x + box.width / 2), extent.height - (box.y + box.height / 2)]
      expect(pixel(image, Math.floor(x * scale), Math.floor(y * scale))).toEqual(RED)
    }
    // Upside down, it stands on its tip: its bottom corners are Off-shape.
    expect(pixel(image, 0, image.height - 1)).toEqual(NONE)
    expect(pixel(image, image.width - 1, image.height - 1)).toEqual(NONE)
  })

  // A Triangle's beads lie nearer its base than its tip: where they lie on average shows which way it points.
  it.each([
    [90, 'points right', (x: number, y: number, w: number, h: number) => [x < w / 2, Math.abs(y - h / 2) < 1]],
    [270, 'points left', (x: number, y: number, w: number, h: number) => [x > w / 2, Math.abs(y - h / 2) < 1]],
  ] as const)('turns a Custom frame a quarter (%i°): it %s', (rotation, _way, expected) => {
    const image = thumbnailPixels(redTriangle(rotation).triangle, 72)
    const red: [number, number][] = []
    for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) if (pixel(image, x, y)[3]) red.push([x + 0.5, y + 0.5])
    const mean = (axis: 0 | 1) => red.reduce((sum, point) => sum + point[axis], 0) / red.length

    expect(image.height).toBeGreaterThan(image.width)
    expect(expected(mean(0), mean(1), image.width, image.height)).toEqual([true, true])
  })
})

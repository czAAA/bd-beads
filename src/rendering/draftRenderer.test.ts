import { describe, expect, it } from 'vitest'
import { rowsGeometry } from '../domain/rowsGeometry'
import { describeWeave } from '../domain/weave'
import { DEFAULT_THEME } from './beadLook'
import { draftImage, draftOfBeads, usesDraftLook } from './draftRenderer'

/** The color of one pixel of a draft image, as [r, g, b]. */
function pixel(image: ReturnType<typeof draftImage>, x: number, y: number): number[] {
  const at = (y * image.width + x) * 4
  return [...image.data.slice(at, at + 3)]
}

describe('draftImage', () => {
  it('is one pixel per bead for loom, in the colors of the beads', () => {
    const image = draftImage(describeWeave({ technique: 'loom' }), 2, 2, ['#ff0000', '#00ff00', undefined, '#0000ff'], DEFAULT_THEME)

    expect([image.width, image.height]).toEqual([2, 2])
    expect(pixel(image, 0, 0)).toEqual([255, 0, 0])
    expect(pixel(image, 1, 0)).toEqual([0, 255, 0])
    expect(pixel(image, 0, 1)).toEqual([216, 210, 204]) // an empty bead: the theme's empty color
    expect(pixel(image, 1, 1)).toEqual([0, 0, 255])
    expect(image.data[3]).toBe(255)
  })

  it('makes each brick stitch bead two pixels wide and shifts every other row by one, so the rows sit half a bead apart', () => {
    const image = draftImage(describeWeave({ technique: 'brick' }), 2, 2, ['#ff0000', '#00ff00', '#0000ff', '#ffff00'], DEFAULT_THEME)

    expect([image.width, image.height]).toEqual([5, 2])
    expect([0, 1, 2, 3, 4].map((x) => pixel(image, x, 0))).toEqual([[255, 0, 0], [255, 0, 0], [0, 255, 0], [0, 255, 0], [232, 227, 223]])
    expect([0, 1, 2, 3, 4].map((x) => pixel(image, x, 1))).toEqual([[232, 227, 223], [0, 0, 255], [0, 0, 255], [255, 255, 0], [255, 255, 0]])
  })

  it('makes each peyote bead two pixels tall and shifts every other column down by one, so the columns sit half a bead apart (ticket 0734)', () => {
    const image = draftImage(describeWeave({ technique: 'peyote' }), 2, 2, ['#ff0000', '#00ff00', '#0000ff', '#ffff00'], DEFAULT_THEME)
    const background = [232, 227, 223]

    expect([image.width, image.height]).toEqual([2, 5])
    expect([0, 1, 2, 3, 4].map((y) => pixel(image, 0, y))).toEqual([[255, 0, 0], [255, 0, 0], [0, 0, 255], [0, 0, 255], background])
    expect([0, 1, 2, 3, 4].map((y) => pixel(image, 1, y))).toEqual([background, [0, 255, 0], [0, 255, 0], [255, 255, 0], [255, 255, 0]])
  })

  it('draws any shift the geometry has: a third of a bead is three pixels a bead, a shifted row one in (ticket 0623)', () => {
    const thirds = rowsGeometry({ kind: 'rows', shifted: true, shift: 1 / 3, cellAspect: 1, roundness: 0, passes: 'one', block: 1 }, undefined)
    const image = draftImage(thirds, 2, 2, ['#ff0000', '#00ff00', '#0000ff', '#ffff00'], DEFAULT_THEME)

    expect([image.width, image.height]).toEqual([7, 2])
    const [background, blue, yellow] = [[232, 227, 223], [0, 0, 255], [255, 255, 0]]
    expect([0, 1, 2, 3, 4, 5, 6].map((x) => pixel(image, x, 1))).toEqual([background, blue, blue, blue, yellow, yellow, yellow])
  })
})

describe('draftOfBeads (ticket 0675)', () => {
  /** The color and opacity of one pixel, as [r, g, b, a]. */
  const rgba = (image: ReturnType<typeof draftOfBeads>, x: number, y: number) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)]

  it('puts each bead where it lies from the first row and column any bead reaches, clear where there is none', () => {
    const image = draftOfBeads(describeWeave({ technique: 'loom' }), [{ row: 5, column: 7, color: '#ff0000' }, { row: 6, column: 9, color: '#0000ff' }])

    expect(image).toMatchObject({ width: 3, height: 2, firstRow: 5, firstColumn: 7, wide: 1 })
    expect(rgba(image, 0, 0)).toEqual([255, 0, 0, 255])
    expect(rgba(image, 2, 1)).toEqual([0, 0, 255, 255])
    expect(rgba(image, 1, 0)).toEqual([0, 0, 0, 0])
  })

  it('makes a brick stitch bead two pixels wide, a shifted row one pixel in', () => {
    const image = draftOfBeads(describeWeave({ technique: 'brick' }), [{ row: 0, column: 0, color: '#ff0000' }, { row: 1, column: 0, color: '#0000ff' }])

    expect(image).toMatchObject({ width: 3, height: 2, wide: 2, tall: 1 })
    expect([0, 1, 2].map((x) => rgba(image, x, 1)[3])).toEqual([0, 255, 255])
  })

  it('makes a peyote bead two pixels tall, a shifted column one pixel down (ticket 0734)', () => {
    const image = draftOfBeads(describeWeave({ technique: 'peyote' }), [{ row: 0, column: 0, color: '#ff0000' }, { row: 0, column: 1, color: '#0000ff' }])

    expect(image).toMatchObject({ width: 2, height: 3, wide: 1, tall: 2 })
    expect([0, 1, 2].map((y) => rgba(image, 1, y)[3])).toEqual([0, 255, 255])
    expect([0, 1, 2].map((y) => rgba(image, 0, y)[3])).toEqual([255, 255, 0])
  })
})

describe('usesDraftLook', () => {
  it('keeps the real look for a small block of beads in every Technique', () => {
    expect(usesDraftLook('loom', 2_000)).toBe(false)
    expect(usesDraftLook('peyote', 2_000)).toBe(false)
    expect(usesDraftLook('brick', 2_000)).toBe(false)
  })

  it('goes coarse sooner for peyote, whose rounded beads are dearer to draw than loom and brick stitch square ones', () => {
    expect(usesDraftLook('peyote', 8_000)).toBe(true)
    expect(usesDraftLook('loom', 8_000)).toBe(false)
    expect(usesDraftLook('brick', 8_000)).toBe(false)
  })

  it('goes coarse for the biggest blocks in every Technique', () => {
    expect(usesDraftLook('loom', 62_500)).toBe(true)
    expect(usesDraftLook('brick', 62_500)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from './beadLook'
import { draftImage, usesDraftLook } from './draftRenderer'

/** The color of one pixel of a draft image, as [r, g, b]. */
function pixel(image: ReturnType<typeof draftImage>, x: number, y: number): number[] {
  const at = (y * image.width + x) * 4
  return [...image.data.slice(at, at + 3)]
}

describe('draftImage', () => {
  it('is one pixel per bead for loom, in the colors of the beads', () => {
    const image = draftImage('loom', 2, 2, ['#ff0000', '#00ff00', undefined, '#0000ff'], DEFAULT_THEME)

    expect([image.width, image.height]).toEqual([2, 2])
    expect(pixel(image, 0, 0)).toEqual([255, 0, 0])
    expect(pixel(image, 1, 0)).toEqual([0, 255, 0])
    expect(pixel(image, 0, 1)).toEqual([199, 205, 213]) // an empty bead: the theme's empty color
    expect(pixel(image, 1, 1)).toEqual([0, 0, 255])
    expect(image.data[3]).toBe(255)
  })

  it('makes each peyote bead two pixels wide and shifts every other row by one, so the rows sit half a bead apart', () => {
    const image = draftImage('peyote', 2, 2, ['#ff0000', '#00ff00', '#0000ff', '#ffff00'], DEFAULT_THEME)

    expect([image.width, image.height]).toEqual([5, 2])
    expect([0, 1, 2, 3, 4].map((x) => pixel(image, x, 0))).toEqual([[255, 0, 0], [255, 0, 0], [0, 255, 0], [0, 255, 0], [255, 255, 255]])
    expect([0, 1, 2, 3, 4].map((x) => pixel(image, x, 1))).toEqual([[255, 255, 255], [0, 0, 255], [0, 0, 255], [255, 255, 0], [255, 255, 0]])
  })

  it('shifts brick stitch rows the same way', () => {
    expect(draftImage('brick', 3, 2, new Array(6).fill('#000000'), DEFAULT_THEME).width).toBe(7)
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

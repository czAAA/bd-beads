// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { toHex } from './color'
import { nearestColor, reducePictureColors } from './imageColors'

function counts(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries))
}

describe('nearestColor', () => {
  it('finds the closest of the colors offered', () => {
    expect(nearestColor(['#000000', '#ffffff'], '#111111')).toBe('#000000')
    expect(nearestColor(['#000000', '#ffffff'], '#eeeeee')).toBe('#ffffff')
  })

  it('picks the color that looks closest, where plain RGB distance misjudged the hue (ticket 0634)', () => {
    // By RGB distance a leaf green went to brown and a sky blue to grey.
    const builtIns = ['#e63746', '#27ae60', '#2fb6ae', '#8a5a3b', '#9aa0a6']
    expect(nearestColor(builtIns, '#70a040')).toBe('#27ae60')
    expect(nearestColor(builtIns, '#87ceeb')).toBe('#2fb6ae')
  })

  it('picks the nearest color rather than the first one in range', () => {
    expect(nearestColor(['#9aa0a6', '#ffffff'], '#fefefe')).toBe('#ffffff')
  })

  it('has nothing to offer for an empty set', () => {
    expect(nearestColor([], '#111111')).toBeUndefined()
  })
})

describe('reducePictureColors (ticket 177, ADR 0010)', () => {
  it('keeps a picture inside the limit exactly as it is', () => {
    const reduced = reducePictureColors(counts({ '#ff0000': 4, '#00a000': 2, '#0000ff': 1 }), 8)

    expect(reduced.colors).toEqual([
      { hex: '#ff0000', count: 4 },
      { hex: '#00a000', count: 2 },
      { hex: '#0000ff', count: 1 },
    ])
    expect(reduced.byHex.get('#00a000')).toBe('#00a000')
  })

  it('orders the colors it kept by how much of the picture they cover', () => {
    const reduced = reducePictureColors(counts({ '#00a000': 1, '#ff0000': 9, '#0000ff': 5 }), 8)

    expect(reduced.colors.map((color) => color.hex)).toEqual(['#ff0000', '#0000ff', '#00a000'])
  })

  it('reduces a busier picture to at most the count asked for', () => {
    const busy = counts(
      Object.fromEntries(Array.from({ length: 40 }, (_unused, index) => [toHex({ r: index * 6, g: 20, b: 200 }), 1])),
    )

    const reduced = reducePictureColors(busy, 4)

    expect(reduced.colors.length).toBeLessThanOrEqual(4)
    // Every sampled color still becomes one of them, and the counts add up to the picture.
    for (const hex of busy.keys()) {
      expect(reduced.colors.map((color) => color.hex)).toContain(reduced.byHex.get(hex))
    }
    expect(reduced.colors.reduce((sum, color) => sum + color.count, 0)).toBe(40)
  })

  it('reduces to a single color when only one is allowed', () => {
    const reduced = reducePictureColors(counts({ '#ff0000': 1, '#0000ff': 1 }), 1)

    expect(reduced.colors).toHaveLength(1)
    expect(reduced.byHex.get('#ff0000')).toBe(reduced.colors[0]!.hex)
    expect(reduced.byHex.get('#0000ff')).toBe(reduced.colors[0]!.hex)
  })

  it('finds nothing in a picture with no painted pixels at all', () => {
    const reduced = reducePictureColors(counts({}), 8)

    expect(reduced.colors).toEqual([])
    expect(reduced.byHex.size).toBe(0)
  })

  // Ticket 0747: the Colors slider goes up to every color the picture has, so a photo asks for thousands.
  it('takes any count, keeping that many of a photo', () => {
    // 20 000 distinct colors, spread over the cube.
    const photo = new Map(Array.from({ length: 20000 }, (_unused, i) => [toHex({ r: i & 255, g: (i >> 8) & 255, b: (i * 37) & 255 }), 1]))

    const reduced = reducePictureColors(photo, 10000)
    expect(reduced.colors).toHaveLength(10000)
    expect(reduced.colors.reduce((sum, color) => sum + color.count, 0)).toBe(20000)
  })

  it('weights a reduction by how much of the picture each color covers', () => {
    // Nearly all of the picture is black, so the one color it keeps lands near it.
    const reduced = reducePictureColors(counts({ '#000000': 99, '#ffffff': 1 }), 1)

    expect(reduced.colors).toEqual([{ hex: '#030303', count: 100 }])
  })
})

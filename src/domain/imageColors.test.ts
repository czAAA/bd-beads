// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { channelsOf, colorDistance, toHex, toOklab } from './color'
import { LEAST_COLOR_DISTANCE, nearestColor, reducePictureColors } from './imageColors'

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

  // Ticket 0747: the Colors slider goes up to 256; ticket 0890: that is an upper bound, as the least distance holds.
  it('takes the most the slider offers on a photo, keeping as many colors as fit apart', () => {
    // 20 000 distinct colors, spread over the cube.
    const photo = new Map(Array.from({ length: 20000 }, (_unused, i) => [toHex({ r: i & 255, g: (i >> 8) & 255, b: (i * 37) & 255 }), 1]))

    const reduced = reducePictureColors(photo, 256)
    expect(reduced.colors.length).toBeGreaterThan(12)
    expect(reduced.colors.length).toBeLessThanOrEqual(256)
    expect(reduced.colors.reduce((sum, color) => sum + color.count, 0)).toBe(20000)
  })

  it('weights a reduction by how much of the picture each color covers', () => {
    // Nearly all of the picture is black, so the one color it keeps lands near it.
    const reduced = reducePictureColors(counts({ '#000000': 99, '#ffffff': 1 }), 1)

    expect(reduced.colors).toEqual([{ hex: '#030303', count: 100 }])
  })

  // Ticket 0890: a color earns its place by how far it is from the others as well as by how much it covers.
  describe('chooses colors by how different they are (ticket 0890)', () => {
    /** A deterministic stand-in for a photo's noise: the same picture every run. */
    function noise(seed: number): () => number {
      let state = seed
      return () => {
        state = (state * 1103515245 + 12345) % 2147483648
        return state / 2147483648 - 0.5
      }
    }

    const FIGURE = ['#e0b090', '#3c64c8', '#e6c83c', '#f0f0f0', '#c83232', '#3ca03c']
    const GROUND = '#1e1e1e'

    /** Cells sampled around `hex`, each channel off by up to `spread`. */
    function region(hex: string, cells: number, spread: number, random: () => number): string[] {
      const { r, g, b } = channelsOf(hex)
      const off = (channel: number) => Math.max(0, Math.min(255, Math.round(channel + random() * 2 * spread)))
      return Array.from({ length: cells }, () => toHex({ r: off(r), g: off(g), b: off(b) }))
    }

    /** A synthetic portrait: a large dark ground with noise, a small figure in several distinct colors. */
    function portrait(): { counts: Map<string, number>; regions: Map<string, string[]> } {
      const random = noise(7)
      const regions = new Map([[GROUND, region(GROUND, 2500, 22, random)], ...FIGURE.map((hex) => [hex, region(hex, 120, 10, random)] as const)])
      const counts = new Map<string, number>()
      for (const cells of regions.values()) for (const hex of cells) counts.set(hex, (counts.get(hex) ?? 0) + 1)
      return { counts, regions }
    }

    const distance = (a: string, b: string) => colorDistance(toOklab(channelsOf(a)), toOklab(channelsOf(b)))

    it('gives a noisy dark ground one color and each of the figure’s colors a place', () => {
      const { counts, regions } = portrait()
      const reduced = reducePictureColors(counts, 12)

      const ground = new Set(regions.get(GROUND)!.map((hex) => reduced.byHex.get(hex)))
      expect(ground.size).toBe(1)
      const kept = reduced.colors.map((color) => color.hex)
      for (const hex of FIGURE) {
        expect(Math.min(...kept.map((color) => distance(color, hex)))).toBeLessThan(0.03)
      }
    })

    it('blends no two regions into one color between them', () => {
      const { counts, regions } = portrait()
      const reduced = reducePictureColors(counts, regions.size)

      for (const [hex, cells] of regions) {
        const became = new Set(cells.map((cell) => reduced.byHex.get(cell)!))
        expect(became.size).toBe(1)
        expect(distance([...became][0]!, hex)).toBeLessThan(0.03)
      }
    })

    it('keeps no two colors closer than the least distance', () => {
      const { counts } = portrait()
      for (const asked of [4, 12, 30, 256]) {
        const kept = reducePictureColors(counts, asked).colors.map((color) => color.hex)
        for (const a of kept) for (const b of kept) if (a !== b) expect(distance(a, b)).toBeGreaterThanOrEqual(LEAST_COLOR_DISTANCE)
      }
    })
  })
})

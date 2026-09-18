import { describe, expect, it } from 'vitest'
import { PALETTE } from './palette'
import {
  PALETTE_SNAP_DISTANCE,
  colorDistance,
  fromHex,
  nearPaletteColor,
  nearestColor,
  resolveImageColors,
  snapToPalette,
  toHex,
} from './imageColors'

function counts(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries))
}

describe('toHex / fromHex', () => {
  it('writes a lowercase six-digit hex, padding single digits', () => {
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    expect(toHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff')
    expect(toHex({ r: 1, g: 2, b: 3 })).toBe('#010203')
  })

  it('reads a hex back to its channels', () => {
    expect(fromHex('#010203')).toEqual({ r: 1, g: 2, b: 3 })
    expect(fromHex('#E63746')).toEqual({ r: 230, g: 55, b: 70 })
  })

  it('round-trips every Palette color', () => {
    for (const color of PALETTE) {
      expect(toHex(fromHex(color.hex))).toBe(color.hex)
    }
  })
})

describe('colorDistance', () => {
  it('is zero for the same color and symmetric otherwise', () => {
    expect(colorDistance(fromHex('#123456'), fromHex('#123456'))).toBe(0)
    expect(colorDistance(fromHex('#000000'), fromHex('#010101'))).toBeCloseTo(
      colorDistance(fromHex('#010101'), fromHex('#000000')),
    )
  })

  it('is the straight-line distance between the two colors in RGB', () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 })).toBe(5)
  })
})

describe('PALETTE_SNAP_DISTANCE', () => {
  it('is far smaller than the gap between the two closest Palette colors, so no color is near two of them', () => {
    let closest = Infinity
    for (const [index, color] of PALETTE.entries()) {
      for (const other of PALETTE.slice(index + 1)) {
        closest = Math.min(closest, colorDistance(fromHex(color.hex), fromHex(other.hex)))
      }
    }

    expect(PALETTE_SNAP_DISTANCE * 2).toBeLessThan(closest)
  })
})

describe('nearPaletteColor', () => {
  it('finds the Palette color an imperceptibly different color should become', () => {
    expect(nearPaletteColor('#e53845')).toBe('#e63746')
  })

  it('has nothing for a visibly different color', () => {
    expect(nearPaletteColor('#ff0000')).toBeUndefined()
  })

  it('picks the nearest Palette color rather than the first one in range', () => {
    // Nudged towards the Palette's white from grey; whichever comes first in PALETTE, the nearer one wins.
    expect(nearPaletteColor('#fefefe')).toBe('#ffffff')
  })
})

describe('snapToPalette', () => {
  it('leaves a Palette color exactly as it is', () => {
    expect(snapToPalette('#e63746')).toBe('#e63746')
  })

  it('snaps an imperceptibly different color onto the Palette color', () => {
    // One unit off per channel: indistinguishable side by side, and a stranger everywhere else if left as it is.
    expect(snapToPalette('#e53845')).toBe('#e63746')
  })

  it('keeps a visibly different color exactly as extracted', () => {
    expect(snapToPalette('#ff0000')).toBe('#ff0000')
    expect(snapToPalette('#cc2233')).toBe('#cc2233')
  })
})

describe('nearestColor', () => {
  it('finds the closest of the colors offered', () => {
    expect(nearestColor(['#000000', '#ffffff'], '#111111')).toBe('#000000')
    expect(nearestColor(['#000000', '#ffffff'], '#eeeeee')).toBe('#ffffff')
  })

  it('has nothing to offer for an empty set', () => {
    expect(nearestColor([], '#111111')).toBeUndefined()
  })
})

describe('resolveImageColors', () => {
  it('uses a picture already inside the limit exactly, with no quantization at all', () => {
    const resolved = resolveImageColors(counts({ '#ff0000': 4, '#00ff00': 2, '#0000ff': 1 }), 8)

    expect(resolved.colors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
    expect(resolved.mapping.get('#ff0000')).toBe('#ff0000')
    expect(resolved.mapping.get('#0000ff')).toBe('#0000ff')
  })

  it('orders the colors it found by how much of the picture they cover', () => {
    const resolved = resolveImageColors(counts({ '#00ff00': 1, '#ff0000': 9, '#0000ff': 5 }), 8)

    expect(resolved.colors).toEqual(['#ff0000', '#0000ff', '#00ff00'])
  })

  it('reduces a busier picture to the count asked for', () => {
    const busy = counts(
      Object.fromEntries(
        Array.from({ length: 40 }, (_unused, index) => [toHex({ r: index * 6, g: 20, b: 200 }), 1]),
      ),
    )

    const resolved = resolveImageColors(busy, 4)

    expect(resolved.colors).toHaveLength(4)
    // Every sampled color still resolves to one of them.
    for (const hex of busy.keys()) {
      expect(resolved.colors).toContain(resolved.mapping.get(hex))
    }
  })

  it('keeps colors that are far apart apart, even when both are nearest the same Palette color', () => {
    // Snapping everything to the Palette would collapse these two visibly different reds into one (ADR 0011).
    const resolved = resolveImageColors(counts({ '#ff0000': 5, '#cc2233': 5 }), 8)

    expect(new Set(resolved.colors).size).toBe(2)
    expect(resolved.mapping.get('#ff0000')).not.toBe(resolved.mapping.get('#cc2233'))
  })

  it('snaps a near-exact match onto its Palette color', () => {
    const resolved = resolveImageColors(counts({ '#e53845': 5, '#000000': 1 }), 8)

    expect(resolved.colors).toContain('#e63746')
    expect(resolved.mapping.get('#e53845')).toBe('#e63746')
  })

  it('refuses to snap when two colors are near the same Palette color, so snapping never merges them', () => {
    // Both are within PALETTE_SNAP_DISTANCE of the Palette's white, and 7 apart from each other: snapping both would
    // collapse two colors the picture kept apart, which is the quantization ADR 0011 rejects.
    const resolved = resolveImageColors(counts({ '#ffffff': 5, '#fbfbfb': 5 }), 8)

    expect(new Set(resolved.colors)).toEqual(new Set(['#ffffff', '#fbfbfb']))
    expect(resolved.mapping.get('#ffffff')).toBe('#ffffff')
    expect(resolved.mapping.get('#fbfbfb')).toBe('#fbfbfb')
  })

  it('never resolves two distinct colors to the same Image color while both fit inside the limit', () => {
    const colors = ['#ffffff', '#fbfbfb', '#e63746', '#e53845', '#1a1a1a', '#1c1b1b']
    const resolved = resolveImageColors(
      counts(Object.fromEntries(colors.map((hex) => [hex, 1]))),
      colors.length,
    )

    expect(new Set(resolved.colors).size).toBe(colors.length)
  })

  it('reduces to a single color when only one is allowed', () => {
    const resolved = resolveImageColors(counts({ '#ff0000': 1, '#0000ff': 1 }), 1)

    expect(resolved.colors).toHaveLength(1)
    expect(resolved.mapping.get('#ff0000')).toBe(resolved.colors[0])
    expect(resolved.mapping.get('#0000ff')).toBe(resolved.colors[0])
  })

  it('finds nothing in a picture with no painted pixels at all', () => {
    const resolved = resolveImageColors(counts({}), 8)

    expect(resolved.colors).toEqual([])
    expect(resolved.mapping.size).toBe(0)
  })

  it('keeps a single-color picture at that exact color', () => {
    const resolved = resolveImageColors(counts({ '#123456': 99 }), 8)

    expect(resolved.colors).toEqual(['#123456'])
  })

  it('never resolves two sampled colors to a color neither of them is near', () => {
    // Black and white reduced to one: the representative has to sit between them, not at an unrelated hue.
    const resolved = resolveImageColors(counts({ '#000000': 1, '#ffffff': 1 }), 1)
    const only = fromHex(resolved.colors[0]!)

    expect(only.r).toBe(only.g)
    expect(only.g).toBe(only.b)
    expect(only.r).toBeGreaterThan(100)
    expect(only.r).toBeLessThan(160)
  })

  it('weights a reduction by how much of the picture each color covers', () => {
    // Nearly all of the picture is the dark color, so the one representative has to land near it.
    const resolved = resolveImageColors(counts({ '#000000': 99, '#ffffff': 1 }), 1)

    expect(fromHex(resolved.colors[0]!).r).toBeLessThan(40)
  })
})

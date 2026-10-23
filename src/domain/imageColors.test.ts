// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BUILT_IN_COLORS, addedColorId, createPalette, defaultPaletteIds } from './palette'
import { colorDistance, channelsOf, nearestColor, resolveImageColors, snapToPalette, toHex } from './imageColors'

const palette = createPalette(defaultPaletteIds())

function counts(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries))
}

describe('toHex / channelsOf', () => {
  it('writes a lowercase six-digit hex, padding single digits', () => {
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    expect(toHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff')
    expect(toHex({ r: 1, g: 2, b: 3 })).toBe('#010203')
  })

  it('reads a hex back to its channels', () => {
    expect(channelsOf('#010203')).toEqual({ r: 1, g: 2, b: 3 })
    expect(channelsOf('#E63746')).toEqual({ r: 230, g: 55, b: 70 })
  })

  it('round-trips every Palette color', () => {
    for (const color of BUILT_IN_COLORS) {
      expect(toHex(channelsOf(color.hex))).toBe(color.hex)
    }
  })
})

describe('colorDistance', () => {
  it('is zero for the same color and symmetric otherwise', () => {
    expect(colorDistance(channelsOf('#123456'), channelsOf('#123456'))).toBe(0)
    expect(colorDistance(channelsOf('#000000'), channelsOf('#010101'))).toBeCloseTo(
      colorDistance(channelsOf('#010101'), channelsOf('#000000')),
    )
  })

  it('is the straight-line distance between the two colors in RGB', () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 })).toBe(5)
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

describe('snapToPalette (ticket 177, amending ADR 0011)', () => {
  it('leaves a Palette color exactly as it is', () => {
    expect(snapToPalette(palette, '#e63746')).toBe('#e63746')
  })

  it('snaps an imperceptibly different color onto its Palette color', () => {
    expect(snapToPalette(palette, '#e53845')).toBe('#e63746')
  })

  it('snaps a visibly different color onto its nearest Palette color too, unconditionally', () => {
    // Pure red is not itself a Palette color; it still resolves to the Palette's own red.
    expect(snapToPalette(palette, '#ff0000')).toBe('#e63746')
  })

  it('picks the nearest Palette color rather than the first one in range', () => {
    // Nudged towards the Palette's white from grey; whichever comes first in BUILT_IN_COLORS, the nearer one wins.
    expect(snapToPalette(palette, '#fefefe')).toBe('#ffffff')
  })
})

describe('snapping to the Project’s own Palette (ticket 0530)', () => {
  it('snaps onto an added color, and onto a set that is not the twelve', () => {
    const withAdded = createPalette([...defaultPaletteIds(), addedColorId('#00ff00')])
    expect(snapToPalette(withAdded, '#10f010')).toBe('#00ff00')
    const small = createPalette(['a', 'b'], [{ id: 'a', hex: '#111111' }, { id: 'b', hex: '#eeeeee' }])
    expect(snapToPalette(small, '#e0e0e0')).toBe('#eeeeee')
    expect(resolveImageColors(small, counts({ '#ff0000': 4, '#ffff00': 1 }), 8).colors.sort()).toEqual(['#111111', '#eeeeee'])
  })
})

describe('resolveImageColors (ticket 177, amending ADR 0011)', () => {
  it('quantizes every color onto the Palette, even a picture already inside the limit', () => {
    const resolved = resolveImageColors(palette, counts({ '#ff0000': 4, '#00ff00': 2, '#0000ff': 1 }), 8)

    expect(resolved.mapping.get('#ff0000')).toBe('#e63746') // Palette red
    expect(resolved.mapping.get('#00ff00')).toBe('#27ae60') // Palette green
    expect(resolved.mapping.get('#0000ff')).toBe('#2f6fed') // Palette blue
    for (const hex of resolved.colors) {
      expect(BUILT_IN_COLORS.map((color) => color.hex)).toContain(hex)
    }
  })

  it('orders the colors it found by how much of the picture they cover', () => {
    const resolved = resolveImageColors(palette, counts({ '#00ff00': 1, '#ff0000': 9, '#0000ff': 5 }), 8)

    expect(resolved.colors).toEqual(['#e63746', '#2f6fed', '#27ae60'])
  })

  it('reduces a busier picture to at most the count asked for', () => {
    const busy = counts(
      Object.fromEntries(
        Array.from({ length: 40 }, (_unused, index) => [toHex({ r: index * 6, g: 20, b: 200 }), 1]),
      ),
    )

    const resolved = resolveImageColors(palette, busy, 4)

    expect(resolved.colors.length).toBeLessThanOrEqual(4)
    // Every sampled color still resolves to one of them.
    for (const hex of busy.keys()) {
      expect(resolved.colors).toContain(resolved.mapping.get(hex))
    }
  })

  it('can collapse two visibly different colors onto the same Palette color (ADR 0011 amendment)', () => {
    // Both nearest the Palette's red, even though they're 7 apart from each other.
    const resolved = resolveImageColors(palette, counts({ '#ffffff': 5, '#fbfbfb': 5 }), 8)

    expect(resolved.colors).toEqual(['#ffffff'])
    expect(resolved.mapping.get('#ffffff')).toBe('#ffffff')
    expect(resolved.mapping.get('#fbfbfb')).toBe('#ffffff')
  })

  it('reduces to a single Palette color when only one is allowed', () => {
    const resolved = resolveImageColors(palette, counts({ '#ff0000': 1, '#0000ff': 1 }), 1)

    expect(resolved.colors).toHaveLength(1)
    expect(resolved.mapping.get('#ff0000')).toBe(resolved.colors[0])
    expect(resolved.mapping.get('#0000ff')).toBe(resolved.colors[0])
    expect(BUILT_IN_COLORS.map((color) => color.hex)).toContain(resolved.colors[0])
  })

  it('finds nothing in a picture with no painted pixels at all', () => {
    const resolved = resolveImageColors(palette, counts({}), 8)

    expect(resolved.colors).toEqual([])
    expect(resolved.mapping.size).toBe(0)
  })

  it('snaps a single-color picture onto its nearest Palette color', () => {
    const resolved = resolveImageColors(palette, counts({ '#123456': 99 }), 8)

    expect(resolved.colors).toEqual(['#1a1a1a']) // nearest Palette color to #123456 is black
  })

  it('weights a reduction by how much of the picture each color covers', () => {
    // Nearly all of the picture is the dark color, so the one representative has to land near it, and snap to black.
    const resolved = resolveImageColors(palette, counts({ '#000000': 99, '#ffffff': 1 }), 1)

    expect(resolved.colors).toEqual(['#1a1a1a'])
  })
})

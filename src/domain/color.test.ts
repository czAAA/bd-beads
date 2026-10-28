import { describe, expect, it } from 'vitest'
import { BUILT_IN_COLORS } from './palette'
import { channelsOf, colorDistance, fromHex, luma, mix, normalizeHex, relativeLuminance, toHex, toOklab } from './color'

describe('fromHex', () => {
  it('reads #rrggbb in either case', () => {
    expect(fromHex('#010203')).toEqual({ r: 1, g: 2, b: 3 })
    expect(fromHex('#E63746')).toEqual({ r: 230, g: 55, b: 70 })
  })

  it('reads #rgb as each digit doubled', () => {
    expect(fromHex('#fa0')).toEqual({ r: 255, g: 170, b: 0 })
  })

  it('answers undefined for anything else', () => {
    for (const bad of ['', '#', '#12', '#12345', '#1234567', '123456', '#gggggg', 'rgb(1, 2, 3)', '#ff00ff ']) {
      expect(fromHex(bad)).toBeUndefined()
    }
  })
})

describe('channelsOf', () => {
  it('reads a stored hex, and anything else as black', () => {
    expect(channelsOf('#E63746')).toEqual({ r: 230, g: 55, b: 70 })
    expect(channelsOf('red')).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('toHex', () => {
  it('writes a lowercase six-digit hex, padding single digits', () => {
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    expect(toHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff')
    expect(toHex({ r: 1, g: 2, b: 3 })).toBe('#010203')
  })

  it('rounds each channel to the nearest whole one and holds it inside 0 to 255', () => {
    expect(toHex({ r: 1.5, g: 2.49, b: 254.6 })).toBe('#0202ff')
    expect(toHex({ r: -3, g: 300, b: 0 })).toBe('#00ff00')
  })

  it('round-trips every Palette color', () => {
    for (const color of BUILT_IN_COLORS) {
      expect(toHex(fromHex(color.hex)!)).toBe(color.hex)
    }
  })
})

describe('normalizeHex', () => {
  it('keeps a #rrggbb as the Palette stores it: trimmed and lowercase', () => {
    expect(normalizeHex(' #E63746 ')).toBe('#e63746')
  })

  it('answers undefined for anything else, the short #rgb form included', () => {
    for (const bad of ['', '#fa0', 'e63746', '#e6374', '#e637466', 'red']) {
      expect(normalizeHex(bad)).toBeUndefined()
    }
  })
})

describe('mix', () => {
  it('moves each channel the given share of the way from one color to the other, unrounded', () => {
    expect(mix({ r: 0, g: 100, b: 255 }, { r: 255, g: 255, b: 255 }, 0.25)).toEqual({ r: 63.75, g: 138.75, b: 255 })
    expect(mix({ r: 10, g: 20, b: 30 }, { r: 0, g: 0, b: 0 }, 0)).toEqual({ r: 10, g: 20, b: 30 })
  })
})

describe('relativeLuminance', () => {
  it('is WCAG 2’s relative luminance: 0 for black, 1 for white, each primary its weight', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1)
    expect(relativeLuminance({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.2126, 6)
    expect(relativeLuminance({ r: 0, g: 255, b: 0 })).toBeCloseTo(0.7152, 6)
    expect(relativeLuminance({ r: 128, g: 128, b: 128 })).toBeCloseTo(0.21586, 5)
  })
})

describe('luma', () => {
  it('weighs the channels as stored, as CSS grayscale() does, on the 0 to 255 scale', () => {
    expect(luma({ r: 255, g: 0, b: 0 })).toBeCloseTo(54.213, 3)
    expect(luma({ r: 0, g: 0, b: 255 })).toBeCloseTo(18.411, 3)
    expect(luma({ r: 45, g: 45, b: 45 })).toBeCloseTo(45, 9)
  })
})

describe('toOklab', () => {
  it('puts black at lightness 0 and white at 1, both without hue', () => {
    expect(toOklab({ r: 0, g: 0, b: 0 })).toEqual({ l: 0, a: 0, b: 0 })
    const white = toOklab({ r: 255, g: 255, b: 255 })
    expect(white.l).toBeCloseTo(1, 4)
    expect(white.a).toBeCloseTo(0, 4)
    expect(white.b).toBeCloseTo(0, 4)
  })

  it('places sRGB red where OKLab\'s reference does', () => {
    // Björn Ottosson's published values for #ff0000.
    const red = toOklab({ r: 255, g: 0, b: 0 })
    expect(red.l).toBeCloseTo(0.62796, 4)
    expect(red.a).toBeCloseTo(0.22486, 4)
    expect(red.b).toBeCloseTo(0.12585, 4)
  })
})

describe('colorDistance (ticket 0634)', () => {
  it('is zero for the same color and symmetric otherwise', () => {
    const a = toOklab(fromHex('#123456')!)
    const b = toOklab(fromHex('#654321')!)
    expect(colorDistance(a, a)).toBe(0)
    expect(colorDistance(a, b)).toBe(colorDistance(b, a))
  })

  it('is the straight-line distance in OKLab, so black to white is 1', () => {
    expect(colorDistance(toOklab(fromHex('#000000')!), toOklab(fromHex('#ffffff')!))).toBeCloseTo(1, 4)
  })
})

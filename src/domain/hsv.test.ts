import { describe, expect, it } from 'vitest'
import { hexToHsv, hsToWheelPoint, hsvToHex, parseHexInput, wheelPointToHs, wrapHue } from './hsv'

describe('hsvToHex and hexToHsv', () => {
  it.each([
    ['#ff0000', { h: 0, s: 1, v: 1 }],
    ['#00ff00', { h: 120, s: 1, v: 1 }],
    ['#0000ff', { h: 240, s: 1, v: 1 }],
    ['#ffffff', { h: 0, s: 0, v: 1 }],
    ['#000000', { h: 0, s: 0, v: 0 }],
    ['#808080', { h: 0, s: 0, v: 128 / 255 }],
  ])('%s is %j both ways', (hex, hsv) => {
    const read = hexToHsv(hex)!
    expect(read.h).toBeCloseTo(hsv.h)
    expect(read.s).toBeCloseTo(hsv.s)
    expect(read.v).toBeCloseTo(hsv.v)
    expect(hsvToHex(hsv)).toBe(hex)
  })

  it('round-trips every hex of a coarse sweep of the cube', () => {
    for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 17) {
      const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
      expect(hsvToHex(hexToHsv(hex)!)).toBe(hex)
    }
  })

  it('wraps a hue past a full turn', () => {
    expect(wrapHue(-30)).toBe(330)
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000')
  })

  it('reads only a real hex', () => {
    expect(hexToHsv('nope')).toBeUndefined()
  })
})

describe('parseHexInput', () => {
  it.each([
    ['#1A2B3C', '#1a2b3c'],
    ['1a2b3c', '#1a2b3c'],
    ['#abc', '#aabbcc'],
    ['ABC', '#aabbcc'],
    ['  #fff ', '#ffffff'],
  ])('takes %s as %s', (typed, hex) => expect(parseHexInput(typed)).toBe(hex))

  it.each(['', '#', '#ab', '#abcd', '#abcde', '#1234567', '#ggg', 'red'])('rejects %j', (typed) => expect(parseHexInput(typed)).toBeUndefined())
})

describe('the wheel', () => {
  it('puts hue 0 at the top and runs clockwise', () => {
    expect(wheelPointToHs(0, -50, 100)).toEqual({ h: 0, s: 0.5 })
    expect(wheelPointToHs(100, 0, 100).h).toBeCloseTo(90)
    expect(wheelPointToHs(0, 100, 100).h).toBeCloseTo(180)
    expect(wheelPointToHs(-100, 0, 100).h).toBeCloseTo(270)
  })

  it('holds saturation at the edge beyond it, and is grey at the centre', () => {
    expect(wheelPointToHs(300, 0, 100).s).toBe(1)
    expect(wheelPointToHs(0, 0, 100).s).toBe(0)
  })

  it('maps a point back to where it came from', () => {
    const { dx, dy } = hsToWheelPoint(210, 0.6, 80)
    const { h, s } = wheelPointToHs(dx, dy, 80)
    expect(h).toBeCloseTo(210)
    expect(s).toBeCloseTo(0.6)
  })
})

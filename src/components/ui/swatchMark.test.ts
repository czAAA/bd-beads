import { describe, expect, it } from 'vitest'
import { markOn } from './swatchMark'

describe('markOn', () => {
  const light = { ink: '#1f1f1f', canvas: '#ffffff' }
  const dark = { ink: '#ffffff', canvas: '#141414' }

  it('draws the dark mark on a light swatch and the light mark on a dark one, in the light theme', () => {
    expect(markOn('#fafafa', light.ink, light.canvas)).toBe('ink')
    expect(markOn('#f2c94c', light.ink, light.canvas)).toBe('ink')
    expect(markOn('#1a1a1a', light.ink, light.canvas)).toBe('canvas')
    expect(markOn('#6b3fa0', light.ink, light.canvas)).toBe('canvas')
  })

  it('follows the tokens, not the swatch alone: in dark `ink` is the light one', () => {
    expect(markOn('#fafafa', dark.ink, dark.canvas)).toBe('canvas')
    expect(markOn('#1a1a1a', dark.ink, dark.canvas)).toBe('ink')
  })
})

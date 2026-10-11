import { describe, expect, it } from 'vitest'
import { markOn } from './swatchMark'

describe('markOn', () => {
  it('draws the dark mark on a light swatch', () => {
    expect(markOn('#fafafa')).toBe('dark')
    expect(markOn('#f2c94c')).toBe('dark')
    expect(markOn('#808080')).toBe('dark')
  })

  it('draws the light mark on a dark swatch', () => {
    expect(markOn('#1a1a1a')).toBe('light')
    expect(markOn('#6b3fa0')).toBe('light')
    expect(markOn('#707070')).toBe('light')
  })
})

import { describe, expect, it } from 'vitest'
import { findPaletteColor, PALETTE } from './palette'

describe('PALETTE', () => {
  it('has no duplicate ids', () => {
    const ids = PALETTE.map((color) => color.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('findPaletteColor', () => {
  it('finds a color by id', () => {
    expect(findPaletteColor('red')?.hex).toBe('#e63746')
  })

  it('returns undefined for an unknown id', () => {
    expect(findPaletteColor('not-a-color')).toBeUndefined()
  })
})

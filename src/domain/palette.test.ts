// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_ADDED_COLORS, PALETTE, addUsedColor, addedColorId, findPaletteColor, paletteWith } from './palette'

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

describe('addUsedColor (ticket 227)', () => {
  it('appends a new color, and leaves a built-in or already-added hex alone', () => {
    const first = addUsedColor([], '#123456')
    expect(first).toEqual({ added: ['#123456'], outcome: 'added' })
    expect(addUsedColor(first.added, '#123456').outcome).toBe('known')
    expect(addUsedColor(first.added, PALETTE[0]!.hex.toUpperCase())).toEqual({ added: first.added, outcome: 'known' })
  })

  it('keeps the order of first use', () => {
    const added = addUsedColor(addUsedColor([], '#111111').added, '#222222').added
    expect(paletteWith(added).slice(PALETTE.length).map((c) => c.hex)).toEqual(['#111111', '#222222'])
    expect(paletteWith(added)[PALETTE.length]!.id).toBe(addedColorId('#111111'))
  })

  it('stops at the limit', () => {
    const full = Array.from({ length: MAX_ADDED_COLORS }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)
    expect(addUsedColor(full, '#fedcba')).toEqual({ added: full, outcome: 'full' })
    expect(addUsedColor(full, full[3]!).outcome).toBe('known')
  })
})

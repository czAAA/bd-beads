// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_ADDED_COLORS, PALETTE, addUsedColor, addedColorId, findPaletteColor, paletteWith, removeAddedColor, restoreAddedColor } from './palette'

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

describe('removing an added color (ticket 228)', () => {
  it('takes it out and says where it stood', () => {
    expect(removeAddedColor(['#111111', '#222222', '#333333'], '#222222')).toEqual({ added: ['#111111', '#333333'], index: 1 })
    expect(removeAddedColor(['#111111'], '#999999')).toBeUndefined()
  })

  it('restores it at its place, or not at all when it is back or the Palette is full', () => {
    expect(restoreAddedColor(['#111111', '#333333'], '#222222', 1)).toEqual(['#111111', '#222222', '#333333'])
    expect(restoreAddedColor(['#111111'], '#111111', 0)).toEqual(['#111111'])
    const full = Array.from({ length: MAX_ADDED_COLORS }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)
    expect(restoreAddedColor(full, '#fedcba', 0)).toEqual(full)
  })
})

describe('the Palette limit', () => {
  it('lets 28 colors be added, 40 swatches in all (the Message card)', () => {
    expect(MAX_ADDED_COLORS).toBe(28)
    expect(paletteWith(Array.from({ length: MAX_ADDED_COLORS }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`))).toHaveLength(40)
  })
})

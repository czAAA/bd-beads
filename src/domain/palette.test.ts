// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_ADDED_COLORS, PALETTE, addUsedColor, addedColorId, findPaletteColor, moveSlot, orderedPalette, paletteWith, removeAddedColor, restoreAddedColor } from './palette'

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

describe('orderedPalette (ticket 398)', () => {
  const ids = (colors: { id: string }[]) => colors.map((c) => c.id)

  it('is the default order with no saved order', () => {
    expect(ids(orderedPalette(['#111111'], []))).toEqual(ids(paletteWith(['#111111'])))
  })

  it('follows the saved order, an added color standing between built-in ones', () => {
    const order = ['red', addedColorId('#111111'), 'black']
    const result = ids(orderedPalette(['#111111'], order))
    expect(result.slice(0, 3)).toEqual(order)
    expect(result).toHaveLength(PALETTE.length + 1)
  })

  it('closes up over a color that was removed and appends one the order lacks', () => {
    const order = ['red', addedColorId('#999999'), 'black']
    const result = ids(orderedPalette(['#111111'], order))
    expect(result.slice(0, 2)).toEqual(['red', 'black'])
    expect(result.at(-1)).toBe(addedColorId('#111111'))
  })
})

describe('moveSlot (ticket 398)', () => {
  it('moves one id to a slot, shifting the ones between', () => {
    expect(moveSlot(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveSlot(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('leaves the ids alone for a move that goes nowhere', () => {
    expect(moveSlot(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(moveSlot(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PALETTE, addUsedColor, addedColorId, defaultPaletteIds, findPaletteColor, moveSlot, normalizePaletteIds, paletteColors, paletteFromDevice, removeAddedColor, restoreAddedColor } from './palette'

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

describe('addUsedColor (ticket 227, 0525)', () => {
  it('appends a new color, and leaves a built-in or already-added hex alone', () => {
    const first = addUsedColor(defaultPaletteIds(), '#123456')
    expect(first.outcome).toBe('added')
    expect(first.ids.at(-1)).toBe(addedColorId('#123456'))
    expect(addUsedColor(first.ids, '#123456')).toMatchObject({ ids: first.ids, outcome: 'known' })
    expect(addUsedColor(first.ids, PALETTE[0]!.hex.toUpperCase())).toEqual({ ids: first.ids, outcome: 'known', colorId: 'black' })
  })

  it('keeps the order of first use', () => {
    const next = addUsedColor(addUsedColor(defaultPaletteIds(), '#111111').ids, '#222222').ids
    expect(paletteColors(next).slice(PALETTE.length).map((c) => c.hex)).toEqual(['#111111', '#222222'])
  })

  it('has no cap', () => {
    const many = Array.from({ length: 100 }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)
    const all = many.reduce((palette, hex) => addUsedColor(palette, hex).ids, defaultPaletteIds() as readonly string[])
    expect(paletteColors(all)).toHaveLength(PALETTE.length + 100)
  })

  it('ignores what is not a color', () => {
    expect(addUsedColor(defaultPaletteIds(), 'blue').outcome).toBe('known')
  })
})

describe('removing an added color (ticket 228)', () => {
  const three = [...defaultPaletteIds(), addedColorId('#111111'), addedColorId('#222222'), addedColorId('#333333')]

  it('takes it out and says which slot it stood in', () => {
    expect(removeAddedColor(three, addedColorId('#222222'))).toEqual({ ids: [...defaultPaletteIds(), addedColorId('#111111'), addedColorId('#333333')], slot: PALETTE.length + 1 })
    expect(removeAddedColor(three, addedColorId('#999999'))).toBeUndefined()
  })

  it('never removes a built-in color', () => {
    expect(removeAddedColor(three, 'red')).toBeUndefined()
  })

  it('restores it in its slot, or not at all when it is back', () => {
    const without = removeAddedColor(three, addedColorId('#222222'))!
    expect(restoreAddedColor(without.ids, addedColorId('#222222'), without.slot)).toEqual(three)
    expect(restoreAddedColor(three, addedColorId('#222222'), 0)).toEqual(three)
  })
})

describe('a stored Palette (ticket 0525)', () => {
  it('is the built-in twelve when there is none, or it is unreadable', () => {
    expect(normalizePaletteIds(undefined)).toEqual(defaultPaletteIds())
    expect(normalizePaletteIds('red')).toEqual(defaultPaletteIds())
  })

  it('follows the stored order, an added color standing between built-in ones', () => {
    const order = ['red', addedColorId('#111111'), 'black']
    const result = normalizePaletteIds(order)
    expect(result.slice(0, 3)).toEqual(order)
    expect(result).toHaveLength(PALETTE.length + 1)
  })

  it('drops what it cannot read and what repeats, and appends a built-in color it lacks', () => {
    const result = normalizePaletteIds(['red', 'red', 'added-zzzzzz', 7, 'nonsense', addedColorId('#111111')])
    expect(result.slice(0, 2)).toEqual(['red', addedColorId('#111111')])
    expect(result).toHaveLength(PALETTE.length + 1)
  })
})

describe('paletteFromDevice (temporary, ticket 0525)', () => {
  it('lays the device\'s added colors out in its slot order', () => {
    const order = ['red', addedColorId('#111111'), 'black']
    expect(paletteFromDevice(['#111111', '#222222'], order).slice(0, 3)).toEqual(order)
    expect(paletteFromDevice(['#111111', '#222222'], order).at(-1)).toBe(addedColorId('#222222'))
  })

  it('closes up over a color that was removed', () => {
    expect(paletteFromDevice([], ['red', addedColorId('#999999')])).not.toContain(addedColorId('#999999'))
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

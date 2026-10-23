// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BUILT_IN_COLORS, addUsedColor, defaultPalette, paletteForBead, removedDefaultsAfter, addedColorId, createPalette, defaultPaletteIds, findBuiltInColor, moveSlot, normalizePaletteIds, paletteColors, paletteFromDevice, removeAddedColor, restoreAddedColor, PALETTE_SHORTCUTS, type PaletteColor } from './palette'

describe('BUILT_IN_COLORS', () => {
  it('has no duplicate ids', () => {
    const ids = BUILT_IN_COLORS.map((color) => color.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('findBuiltInColor', () => {
  it('finds a color by id', () => {
    expect(findBuiltInColor('red')?.hex).toBe('#e63746')
  })

  it('returns undefined for an unknown id', () => {
    expect(findBuiltInColor('not-a-color')).toBeUndefined()
  })
})

describe('addUsedColor (ticket 227, 0525)', () => {
  it('appends a new color, and leaves a built-in or already-added hex alone', () => {
    const first = addUsedColor(defaultPaletteIds(), '#123456')
    expect(first.outcome).toBe('added')
    expect(first.ids.at(-1)).toBe(addedColorId('#123456'))
    expect(addUsedColor(first.ids, '#123456')).toMatchObject({ ids: first.ids, outcome: 'known' })
    expect(addUsedColor(first.ids, BUILT_IN_COLORS[0]!.hex.toUpperCase())).toEqual({ ids: first.ids, outcome: 'known', colorId: 'black' })
  })

  it('keeps the order of first use', () => {
    const next = addUsedColor(addUsedColor(defaultPaletteIds(), '#111111').ids, '#222222').ids
    expect(paletteColors(next).slice(BUILT_IN_COLORS.length).map((c) => c.hex)).toEqual(['#111111', '#222222'])
  })

  it('has no cap', () => {
    const many = Array.from({ length: 100 }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)
    const all = many.reduce((palette, hex) => addUsedColor(palette, hex).ids, defaultPaletteIds() as readonly string[])
    expect(paletteColors(all)).toHaveLength(BUILT_IN_COLORS.length + 100)
  })

  it('ignores what is not a color', () => {
    expect(addUsedColor(defaultPaletteIds(), 'blue').outcome).toBe('known')
  })
})

describe('removing an added color (ticket 228)', () => {
  const three = [...defaultPaletteIds(), addedColorId('#111111'), addedColorId('#222222'), addedColorId('#333333')]

  it('takes it out and says which slot it stood in', () => {
    expect(removeAddedColor(three, addedColorId('#222222'))).toEqual({ ids: [...defaultPaletteIds(), addedColorId('#111111'), addedColorId('#333333')], slot: BUILT_IN_COLORS.length + 1 })
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
  it('is the built-in colors when there is none, or it is unreadable', () => {
    expect(normalizePaletteIds(undefined)).toEqual(defaultPaletteIds())
    expect(normalizePaletteIds('red')).toEqual(defaultPaletteIds())
  })

  it('follows the stored order, an added color standing between built-in ones', () => {
    const order = ['red', addedColorId('#111111'), 'black']
    const result = normalizePaletteIds(order)
    expect(result).toEqual(order)
  })

  it('drops what it cannot read and what repeats, and does not re-add a built-in color it leaves out', () => {
    expect(normalizePaletteIds(['red', 'red', 'added-zzzzzz', 7, 'nonsense', addedColorId('#111111')])).toEqual(['red', addedColorId('#111111')])
  })

  it('opens an older build\'s twelve unchanged', () => {
    expect(normalizePaletteIds(defaultPaletteIds())).toEqual(defaultPaletteIds())
  })
})

describe('createPalette (ticket 0530)', () => {
  const brand: readonly PaletteColor[] = [
    { id: 'brand-a', hex: '#102030', literalName: 'Ocean 7' },
    { id: 'brand-b', hex: '#ffeedd' },
    { id: 'brand-c', hex: '#405060' },
  ]
  const ids = ['brand-a', addedColorId('#00ff00'), 'brand-b', 'brand-c']

  it('holds the built-in and added colors in slot order, from a set that is not today\'s twelve', () => {
    expect(createPalette(ids, brand).colors.map((color) => color.id)).toEqual(ids)
    expect(createPalette([], brand).colors).toEqual([])
  })

  it('finds a color by id or by hex, whatever the hex\'s case', () => {
    const palette = createPalette(ids, brand)
    expect(palette.byId('brand-b')?.hex).toBe('#ffeedd')
    expect(palette.byId(null)).toBeUndefined()
    expect(palette.byHex('#FFEEDD')?.id).toBe('brand-b')
    expect(palette.byHex('#000000')).toBeUndefined()
  })

  it('finds the color nearest a hex, added ones included', () => {
    const palette = createPalette(ids, brand)
    expect(palette.nearest('#101010')?.id).toBe('brand-a')
    expect(palette.nearest('#10f010')?.id).toBe(addedColorId('#00ff00'))
    expect(createPalette([], brand).nearest('#101010')).toBeUndefined()
  })

  it('defaults to the first built-in color, with no red needed', () => {
    expect(createPalette(ids, brand).defaultColorId).toBe('brand-a')
    expect(createPalette([addedColorId('#00ff00'), 'brand-c'], brand).defaultColorId).toBe('brand-c')
  })

  it('holds a Palette of any size, 16 swatches for 16 colors', () => {
    const many: PaletteColor[] = Array.from({ length: 16 }, (_, i) => ({ id: `c${i}`, hex: `#0000${i.toString(16).padStart(2, '0')}` }))
    const palette = createPalette(many.map((color) => color.id), many)
    expect(palette.colors).toHaveLength(16)
    expect(palette.besideRecents([])).toHaveLength(16)
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

describe('PALETTE_SHORTCUTS', () => {
  it('are Shift+1…9 and Shift+0, nothing else (ticket 529)', () => {
    expect(PALETTE_SHORTCUTS.map((shortcut) => shortcut.keyLabel)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])
  })
})

describe('Palette.besideRecents', () => {
  const palette = createPalette(defaultPaletteIds())

  it('keeps every slot when no recent is in the Palette', () => {
    expect(palette.besideRecents(['#123456']).map(({ slot }) => slot)).toEqual(palette.colors.map((_color, slot) => slot))
  })

  it('leaves out the slots holding a recent and keeps the order of the rest, each with its slot', () => {
    const shown = palette.besideRecents([palette.colors[2]!.hex, palette.colors[0]!.hex])
    expect(shown.slice(0, 2).map(({ color, slot }) => [color.id, slot])).toEqual([[palette.colors[1]!.id, 1], [palette.colors[3]!.id, 3]])
    expect(shown.map(({ slot }) => slot)).not.toContain(0)
  })
})

describe('defaultPalette (ticket 0528)', () => {
  const delica = defaultPalette('miyuki-delica-11-0')

  it('gives Miyuki its 16 family colors, human names only', () => {
    expect(delica).toHaveLength(16)
    expect(delica.map((color) => color.id)).toEqual(expect.arrayContaining(['beige', 'gold', 'silver', 'crystal', 'iridescent']))
    expect(delica.map((color) => color.id)).not.toContain('teal')
    expect(delica.every((color) => /^[a-z]+$/.test(color.id))).toBe(true)
  })

  it('gives a brand without a set, and a Bead the catalog lacks, the twelve', () => {
    expect(defaultPalette('toho-round-11-0')).toBe(BUILT_IN_COLORS)
    expect(defaultPalette('toho-cube-1.5mm')).toBe(BUILT_IN_COLORS)
    expect(defaultPalette('a-custom-bead')).toBe(BUILT_IN_COLORS)
  })

  it('keeps one hex per id across sets, so a shared color is one color', () => {
    for (const color of delica) {
      const twin = BUILT_IN_COLORS.find((other) => other.id === color.id)
      if (twin) expect(twin.hex).toBe(color.hex)
    }
  })
})

describe('paletteForBead (ticket 0528)', () => {
  const twelve = BUILT_IN_COLORS
  const miyuki = defaultPalette('miyuki-delica-11-0')
  const ids = (colors: readonly PaletteColor[]) => colors.map((color) => color.id)
  const redHex = findBuiltInColor('red')!.hex
  const custom = addedColorId('#123456')

  it('makes the new Bead\'s colors the built-in ones and the old ones added colors after the added ones', () => {
    const moved = paletteForBead([...ids(twelve), custom], [], twelve, miyuki)
    expect(moved.slice(0, 16)).toEqual(ids(miyuki))
    expect(moved[16]).toBe(custom)
    expect(moved.slice(17)).toEqual([addedColorId(findBuiltInColor('teal')!.hex)])
  })

  it('keeps a hex that is in both once, as a built-in color', () => {
    const moved = paletteForBead(ids(twelve), [], twelve, miyuki)
    expect(moved.filter((id) => id === 'red' || id === addedColorId(redHex))).toEqual(['red'])
  })

  it('promotes the old colors back and demotes the others without duplicates (A to B to A)', () => {
    const away = paletteForBead([...ids(twelve), custom], [], twelve, miyuki)
    const back = paletteForBead(away, [], miyuki, twelve)
    expect(back.slice(0, 12)).toEqual(ids(twelve))
    expect(new Set(back).size).toBe(back.length)
    expect(back).toContain(custom)
    expect(back.filter((id) => id.startsWith('added-'))).toEqual([custom, ...ids(miyuki).filter((id) => !ids(twelve).includes(id)).map((id) => addedColorId(miyuki.find((c) => c.id === id)!.hex))])
  })

  it('does not put back a default the maker removed', () => {
    const away = paletteForBead(ids(twelve), [], twelve, miyuki)
    const beige = addedColorId('#e6d5b8')
    const trimmed = away.filter((id) => id !== addedColorId(findBuiltInColor('teal')!.hex))
    const back = paletteForBead(trimmed, ['#2fb6ae'], miyuki, twelve)
    expect(back).not.toContain('teal')
    expect(back).not.toContain(addedColorId('#2fb6ae'))
    expect(back).toContain(beige)
  })

  it('leaves the Palette as it is between two Beads with the same set', () => {
    const arranged = [...ids(twelve).reverse(), custom]
    expect(paletteForBead(arranged, [], twelve, twelve)).toEqual(arranged)
  })
})

describe('removedDefaultsAfter (ticket 0528)', () => {
  const teal = addedColorId('#2fb6ae')

  it('remembers a default color that left the Palette as an added color', () => {
    expect(removedDefaultsAfter(['red', teal], ['red'], [])).toEqual(['#2fb6ae'])
  })

  it('does not remember a Custom color that is no Bead\'s default', () => {
    expect(removedDefaultsAfter([addedColorId('#123456')], [], [])).toEqual([])
  })

  it('forgets a color once it is back in the Palette', () => {
    expect(removedDefaultsAfter(['red'], ['red', teal], ['#2fb6ae'])).toEqual([])
  })
})

describe('a stored Palette against a Bead\'s set (ticket 0528)', () => {
  it('keeps a color of the twelve that the set lacks, as an added color', () => {
    const stored = BUILT_IN_COLORS.map((color) => color.id)
    const read = normalizePaletteIds(stored, defaultPalette('miyuki-delica-11-0'))
    expect(read).toContain(addedColorId('#2fb6ae'))
    expect(read).toHaveLength(12)
  })

  it('starts a missing Palette from the set', () => {
    expect(normalizePaletteIds(undefined, defaultPalette('miyuki-delica-11-0'))).toHaveLength(16)
  })
})

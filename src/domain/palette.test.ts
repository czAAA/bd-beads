// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BACKGROUND_POSITIONS } from './background'
import { BEAD_CATALOG, DEFAULT_BEAD, findBead } from './beads'
import { channelsOf, contrastRatio } from './color'
import { createProject } from './createProject'
import { DEFAULT_COLOR_FILES } from './defaultColors'
import { canvasTheme } from '../rendering/canvasBackgrounds'
import type { ResolvedTheme } from '../theme/theme'
import { BUILT_IN_COLORS, CUSTOM_COLORS, addUsedColor, addUsedColors, brandColors, codesOfColors, familyOf, defaultPalette, addedColorId, createPalette, defaultPaletteIds, findBuiltInColor, moveSlot, paletteColors, readStoredPalette, removeColor, moveSection, catalogName, removeSection, restoreColor, startColorId, storedPalette, PALETTE_SHORTCUTS } from './palette'

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
    expect(addUsedColor(first.ids, BUILT_IN_COLORS[0]!.hex.toUpperCase())).toEqual({ ids: first.ids, outcome: 'known', colorId: 'black', codes: {} })
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

describe('removing a color (tickets 228, 1226)', () => {
  const three = [...defaultPaletteIds(), addedColorId('#111111'), addedColorId('#222222'), addedColorId('#333333')]

  it('takes it out and says which slot it stood in', () => {
    expect(removeColor(three, addedColorId('#222222'))).toEqual({ ids: [...defaultPaletteIds(), addedColorId('#111111'), addedColorId('#333333')], slot: BUILT_IN_COLORS.length + 1 })
    expect(removeColor(three, addedColorId('#999999'))).toBeUndefined()
  })

  it('removes a default color too, as the Palette is the Project\'s own (ticket 1226)', () => {
    expect(removeColor(three, 'black')).toEqual({ ids: three.slice(1), slot: 0 })
  })

  it('restores it in its slot, or not at all when it is back', () => {
    const without = removeColor(three, addedColorId('#222222'))!
    expect(restoreColor(without.ids, addedColorId('#222222'), without.slot)).toEqual(three)
    expect(restoreColor(three, addedColorId('#222222'), 0)).toEqual(three)
  })
})

describe('moving a section (ticket 1226)', () => {
  const toho = { catalog: 'toho', code: '1' }
  const delica = { catalog: 'miyuki-delica', code: 'DB1' }
  const ids = [addedColorId('#111111'), addedColorId('#222222'), addedColorId('#333333'), addedColorId('#444444')]
  const codes = { '#111111': toho, '#222222': delica, '#333333': toho }
  const order = (held: readonly string[]) => createPalette(held, codes).sections.map((section) => section.id)

  it('moves it among the others with its swatches, whichever order they were held in', () => {
    expect(order(ids)).toEqual(['toho', 'miyuki-delica', CUSTOM_COLORS])
    expect(order(moveSection(ids, codes, 'toho', 1))).toEqual(['miyuki-delica', 'toho', CUSTOM_COLORS])
    expect(createPalette(moveSection(ids, codes, CUSTOM_COLORS, -2), codes).colors.map((color) => color.hex)).toEqual(['#444444', '#111111', '#333333', '#222222'])
  })

  it('stays where it is at either end, or when the Palette has no such section', () => {
    expect(moveSection(ids, codes, 'toho', -1)).toBe(ids)
    expect(moveSection(ids, codes, CUSTOM_COLORS, 1)).toBe(ids)
    expect(moveSection(ids, codes, 'miyuki-round', 1)).toBe(ids)
  })
})

describe('a catalog\'s name (ticket 1226)', () => {
  it('is the maker\'s own, and the id for a catalog this build does not know', () => {
    expect([catalogName('toho'), catalogName('miyuki-delica'), catalogName('miyuki-round'), catalogName('other')]).toEqual(['TOHO', 'Miyuki Delica', 'Miyuki Round', 'other'])
  })
})

describe('createPalette (ticket 0530)', () => {
  const ids = ['brown', addedColorId('#00ff00'), 'white', 'grey']

  it('holds the built-in and added colors in slot order', () => {
    expect(createPalette(ids).colors.map((color) => color.id)).toEqual(ids)
    expect(createPalette([]).colors).toEqual([])
  })

  it('finds a color by id or by hex, whatever the hex\'s case', () => {
    const palette = createPalette(ids)
    expect(palette.byId('white')?.hex).toBe('#ffffff')
    expect(palette.byId(null)).toBeUndefined()
    expect(palette.byHex('#FFFFFF')?.id).toBe('white')
    expect(palette.byHex('#000000')).toBeUndefined()
  })

  it('finds the color nearest a hex, added ones included', () => {
    const palette = createPalette(ids)
    expect(palette.nearest('#8a5a3a')?.id).toBe('brown')
    expect(palette.nearest('#10f010')?.id).toBe(addedColorId('#00ff00'))
    expect(createPalette([]).nearest('#101010')).toBeUndefined()
  })

  it('defaults to the first built-in color, with no red needed', () => {
    expect(createPalette(ids).defaultColorId).toBe('brown')
    expect(createPalette([addedColorId('#00ff00'), 'grey']).defaultColorId).toBe('grey')
  })

  it('holds a Palette of any size, 16 swatches for 16 colors', () => {
    const many = Array.from({ length: 16 }, (_, i) => addedColorId(`#0000${i.toString(16).padStart(2, '0')}`))
    expect(createPalette(many).colors).toHaveLength(16)
  })

  it('drops what names no color and a hex that repeats, as a hex is one swatch', () => {
    expect(createPalette(['red', 'red', 'added-zzzzzz', 'nonsense', addedColorId('#e63746'), addedColorId('#111111')]).colors.map((color) => color.id)).toEqual(['red', addedColorId('#111111')])
  })
})

describe('the Palette in sections (ADR 0103)', () => {
  const delica = defaultPalette('miyuki/delica/11-0')
  const toho = { catalog: 'toho', code: '341' }

  it('knows its colors whatever Bead it is in: a default color by its code, named by its family', () => {
    const palette = createPalette(delica.map((color) => color.id), codesOfColors(delica))
    expect(palette.colors).toEqual(delica)
    expect(palette.sections).toEqual([{ id: 'miyuki-delica', colors: delica }])
  })

  it('puts each color in its code\'s catalog\'s section, the rest in Custom colors, each section\'s together in the order they first show', () => {
    const ids = [addedColorId('#111111'), delica[0]!.id, addedColorId('#222222'), addedColorId('#333333'), delica[1]!.id]
    const codes = { ...codesOfColors(delica), '#222222': toho }
    const palette = createPalette(ids, codes)
    expect(palette.sections.map((section) => [section.id, section.colors.map((color) => color.id)])).toEqual([
      [CUSTOM_COLORS, [addedColorId('#111111'), addedColorId('#333333')]],
      ['miyuki-delica', [delica[0]!.id, delica[1]!.id]],
      ['toho', [addedColorId('#222222')]],
    ])
    expect(palette.colors.map((color) => color.id)).toEqual(palette.sections.flatMap((section) => section.colors.map((color) => color.id)))
    expect(palette.byId(addedColorId('#222222'))).toMatchObject({ code: '341', catalog: 'toho' })
  })

  it('shows a section only while it holds a color', () => {
    expect(createPalette([]).sections).toEqual([])
    expect(createPalette(defaultPaletteIds()).sections.map((section) => section.id)).toEqual([CUSTOM_COLORS])
  })

  it('keeps a default color its catalog no longer names as an added color of its hex', () => {
    expect(createPalette(['default-123456'], { '#123456': { catalog: 'miyuki-delica', code: 'DB-none' } }).colors).toEqual([{ id: addedColorId('#123456'), hex: '#123456', code: 'DB-none', catalog: 'miyuki-delica' }])
    expect(createPalette(['default-123456']).colors.map((color) => color.id)).toEqual([addedColorId('#123456')])
  })

  it('adds a code from any catalog last in its section, and knows it once there', () => {
    const start = delica.map((color) => color.id)
    const added = addUsedColor([...start, addedColorId('#111111')], '#abcdef', codesOfColors(delica), toho)
    expect(added).toMatchObject({ outcome: 'added', colorId: addedColorId('#abcdef'), codes: { '#abcdef': toho } })
    const codes = { ...codesOfColors(delica), ...added.codes }
    expect(createPalette(added.ids, codes).sections.map((section) => section.id)).toEqual(['miyuki-delica', CUSTOM_COLORS, 'toho'])
    expect(addUsedColor(added.ids, '#abcdef', codes, toho)).toMatchObject({ ids: added.ids, outcome: 'known', colorId: addedColorId('#abcdef') })
  })

  it('nudges a code whose hex another section holds one step, so a hex names one swatch and one code', () => {
    const ids = delica.map((color) => color.id)
    const taken = delica[0]!.hex
    const added = addUsedColor(ids, taken, codesOfColors(delica), toho)
    const nudged = added.colorId!.replace('added-', '#')
    expect(nudged).not.toBe(taken)
    const [was, now] = [channelsOf(taken), channelsOf(nudged)]
    expect(Math.abs(was.r - now.r) + Math.abs(was.g - now.g) + Math.abs(was.b - now.b)).toBe(1)
    expect(added.codes).toEqual({ [nudged]: toho })
    expect(createPalette(added.ids, { ...codesOfColors(delica), ...added.codes }).byHex(taken)).toEqual(delica[0])
  })

  it('takes a plain color whose hex is a swatch for that swatch, whatever its section', () => {
    expect(addUsedColor(delica.map((color) => color.id), delica[2]!.hex, codesOfColors(delica))).toMatchObject({ outcome: 'known', colorId: delica[2]!.id })
  })

  it('removes a whole section, its default colors too, and each comes back in its slot', () => {
    const ids = [...delica.slice(0, 2).map((color) => color.id), addedColorId('#111111'), addedColorId('#222222')]
    const codes = { ...codesOfColors(delica), '#222222': toho }
    const { ids: left, removed } = removeSection(ids, codes, 'miyuki-delica')
    expect(left).toEqual([addedColorId('#111111'), addedColorId('#222222')])
    expect(removed).toEqual([{ colorId: delica[0]!.id, slot: 0 }, { colorId: delica[1]!.id, slot: 1 }])
    expect(removed.reduce((acc, { colorId, slot }) => restoreColor(acc, colorId, slot), left)).toEqual(ids)
    expect(removeSection(ids, codes, 'miyuki-round').removed).toEqual([])
  })
})

describe('a stored Palette (ticket 0525, ADR 0103)', () => {
  const delica = defaultPalette('miyuki/delica/11-0')
  const toho = { catalog: 'toho', code: '341' }

  it('is stored in its sections, each code beside by hex, and read back as it was', () => {
    const ids = [...delica.map((color) => color.id), addedColorId('#111111'), addedColorId('#222222')]
    const codes = { ...codesOfColors(delica), '#222222': toho }
    const stored = storedPalette(ids, codes)
    expect(stored.palette).toEqual([{ catalog: 'miyuki-delica', colors: delica.map((color) => color.id) }, { colors: [addedColorId('#111111')] }, { catalog: 'toho', colors: [addedColorId('#222222')] }])
    expect(stored.paletteCodes).toMatchObject({ '#222222': '341', [delica[0]!.hex]: delica[0]!.code })
    expect(readStoredPalette(stored.palette, stored.paletteCodes, 'toho/cube/1.5mm')).toEqual({ ids, codes })
  })

  it('drops what it cannot read from a section, and a code of Custom colors', () => {
    const stored = [{ colors: ['red', 7, 'nonsense', addedColorId('#111111')] }, 'black', { catalog: 'toho' }]
    expect(readStoredPalette(stored, { '#111111': '5', '#e63746': 7 }, 'toho/cube/1.5mm')).toEqual({ ids: ['red', addedColorId('#111111')], codes: {} })
  })

  describe('saved before its sections, sorted by the Bead it was woven in', () => {
    it('is the Bead\'s default colors when there is none, or it is unreadable', () => {
      for (const stored of [undefined, 'red']) {
        expect(readStoredPalette(stored, undefined, 'miyuki-delica-11-0')).toEqual({ ids: delica.map((color) => color.id), codes: codesOfColors(delica) })
      }
    })

    it('follows the stored order within each section, and drops what it cannot read and what repeats', () => {
      const generic = defaultPalette('toho/round/10-0')
      expect(readStoredPalette(['red', addedColorId('#111111'), 'red', 'added-zzzzzz', 7, 'black'], undefined, 'toho/round/10-0').ids).toEqual(['red', addedColorId('#111111'), 'black'])
      expect(readStoredPalette(defaultPaletteIds(generic), undefined, 'toho/round/10-0').ids).toEqual(defaultPaletteIds(generic))
    })

    it('puts every code, the default colors\' included, in that Bead\'s catalog, and the rest in Custom colors', () => {
      const read = readStoredPalette([addedColorId('#111111'), ...delica.map((color) => color.id), addedColorId('#222222')], { '#222222': 'DB1' }, 'miyuki-delica-11-0')
      expect(read.codes).toEqual({ ...codesOfColors(delica), '#222222': { catalog: 'miyuki-delica', code: 'DB1' } })
      expect(createPalette(read.ids, read.codes).sections.map((section) => [section.id, section.colors.length])).toEqual([[CUSTOM_COLORS, 1], ['miyuki-delica', delica.length + 1]])
    })

    it('keeps a color of the twelve that the set lacks, as an added color', () => {
      const read = readStoredPalette(BUILT_IN_COLORS.map((color) => color.id), undefined, 'miyuki-delica-11-0').ids
      expect(read).toContain(addedColorId('#2fb6ae'))
      expect(read).toHaveLength(12)
    })

    it('keeps every generic color of a Project saved before default colors were codes, as an added color of its hex (ticket 1070)', () => {
      const stored = [...brandColors('toho').map((color) => color.id), addedColorId('#123456')]
      expect(readStoredPalette(stored, undefined, 'toho/cube/1.5mm').ids).toEqual([...brandColors('toho').map((color) => addedColorId(color.hex)), addedColorId('#123456')])
    })

    it('keeps a default color the Bead no longer names as an added color of its hex (ticket 1070)', () => {
      expect(readStoredPalette(['default-123456'], undefined, 'miyuki-delica-11-0').ids).toEqual([addedColorId('#123456')])
    })
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

describe('defaultPalette (tickets 0528, 1070)', () => {
  const delica = defaultPalette('miyuki-delica-11-0')

  it('gives a Bead its catalog\'s default colors, one per color family in the Brand\'s order, with code and measured color', () => {
    const named = DEFAULT_COLOR_FILES['miyuki-delica']!.sizes['11/0']!
    const families = brandColors('miyuki').map((color) => color.id).filter((family) => named[family])
    expect(delica.map((color) => color.family)).toEqual(families)
    expect(delica.map(({ code, hex }) => ({ code, hex }))).toEqual(families.map((family) => named[family]))
    expect(delica[0]).toMatchObject({ family: 'black', code: 'DB10' })
  })

  it('knows a default color by its hex, never by a family id, so a generic color stays itself', () => {
    expect(delica.map((color) => color.id)).toEqual(delica.map((color) => `default-${color.hex.slice(1)}`))
  })

  it('names the codes of the Bead\'s own size: Delica 15/0 is DBS, not DB', () => {
    expect(defaultPalette('miyuki/delica/15-0').every((color) => color.code!.startsWith('DBS'))).toBe(true)
  })

  it('is the same array every time, so two Beads compare by identity', () => {
    expect(defaultPalette('miyuki/delica/11-0')).toBe(delica)
    expect(defaultPalette('toho-round-11-0')).not.toBe(defaultPalette('toho-cube-1.5mm'))
  })

  it('gives a Bead whose catalog lists no codes in its size its Brand\'s generic family colors (TOHO Round 10/0)', () => {
    const generic = defaultPalette('toho/round/10-0')
    expect(generic).toBe(findBead('toho/round/10-0')!.brand.colorFamilies)
    expect(generic).toHaveLength(21)
  })

  it('gives a Bead the catalog lacks the twelve', () => {
    expect(defaultPalette('a-custom-bead')).toBe(BUILT_IN_COLORS)
  })

  it('keeps one hex per id across sets, so a shared color is one color', () => {
    for (const color of BEAD_CATALOG.flatMap((bead) => bead.brand.colorFamilies ?? [])) {
      const twin = BUILT_IN_COLORS.find((other) => other.id === color.id)
      if (twin) expect(twin.hex).toBe(color.hex)
    }
  })
})

describe('the first color on a new Project\'s Background (ticket 0838)', () => {
  const contrast = (a: string, b: string) => contrastRatio(channelsOf(a), channelsOf(b))
  /** A new Project on this Bead and a theme's numbered Background, as the app makes it, and the color it starts painting with there. */
  const startOn = (beadId: string, theme: ResolvedTheme, background: number) => {
    const project = createProject({ technique: 'loom', beadId, background })
    const palette = createPalette(project.palette, project.paletteCodes)
    const canvas = canvasTheme(theme, background).canvas
    return { canvas, color: palette.byId(startColorId(palette, canvas)) }
  }

  const offered = BEAD_CATALOG.filter((bead) => !bead.retired).map((bead) => bead.id)
  const has = (beadId: string, family: string) => defaultPalette(beadId).some((color) => familyOf(color) === family)
  const familyAt = (beadId: string, theme: ResolvedTheme) => {
    const color = startOn(beadId, theme, 1).color
    return color && familyOf(color)
  }

  // The family's default color (ticket 1070), yellow's where the Bead has no gold.
  it.each(offered)('starts %s on gold in dark, or yellow without one', (beadId) => {
    expect(familyAt(beadId, 'dark')).toBe(has(beadId, 'gold') ? 'gold' : 'yellow')
  })

  it.each(offered.filter((beadId) => has(beadId, 'red')))('starts %s on red in light and high contrast', (beadId) => {
    expect(familyAt(beadId, 'light')).toBe('red')
    expect(familyAt(beadId, 'contrast')).toBe('red')
  })

  it.each(['light', 'dark', 'contrast'] as const)('stands the first color off every Background of %s at 3:1 or more, a swatch of the Bead\'s own', (theme) => {
    for (let position = 1; position <= BACKGROUND_POSITIONS; position++) {
      const { canvas, color } = startOn(DEFAULT_BEAD.id, theme, position)
      expect(defaultPalette(DEFAULT_BEAD.id), `${theme} ${position}`).toContainEqual(color)
      expect(contrast(color!.hex, canvas), `${theme} ${position}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('takes yellow on a dark Background where the Palette has no gold, as the twelve built-in colors', () => {
    expect(startColorId(createPalette(defaultPaletteIds()), '#202020')).toBe('yellow')
  })

  it('takes the swatch that stands off a Custom color best where neither reaches 3:1', () => {
    const toho = createPalette(defaultPaletteIds(defaultPalette('toho/round/10-0')))
    // Red on a red Custom color, gold on a gold one: neither shows, so the swatch that shows most.
    expect(startColorId(toho, '#e63746')).toBe('white')
    expect(startColorId(toho, '#d4af37')).toBe('black')
  })

  it('has no color for an empty Palette', () => {
    expect(startColorId(createPalette([]), '#202020')).toBeUndefined()
  })
})

describe('addUsedColors', () => {
  it('adds each color the Palette lacks once, leaving the held ones where they are', () => {
    const ids = addUsedColors([addedColorId('#111111')], ['#222222', '#111111', '#222222'])
    expect(ids).toEqual([addedColorId('#111111'), addedColorId('#222222')])
  })
})

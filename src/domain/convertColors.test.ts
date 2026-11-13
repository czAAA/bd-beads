// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ColorCatalog } from './colorCatalog'
import { BUILT_IN_COLORS, addedColorId } from './palette'
import { channelsOf, colorDistance, toOklab } from './color'
import { LEAST_COLOR_DISTANCE, reducePictureColors, type ReducedColors } from './imageColors'
import {
  beadColorRows,
  beadColorTargets,
  convertFrame,
  matchFoundColors,
  newProjectPalette,
  sourceTargets,
  type FoundColorChoice,
} from './convertColors'

const reduced = (entries: Record<string, number>) => reducePictureColors(new Map(Object.entries(entries)), 14)
const choices = (entries: Record<string, FoundColorChoice> = {}) => new Map(Object.entries(entries))
const defaults = sourceTargets('default', BUILT_IN_COLORS, [])
/** A reduced picture of these colors, as the reduction hands it over. */
const reducedPicture = (entries: Record<string, number>): ReducedColors => ({
  colors: Object.entries(entries).map(([hex, count]) => ({ hex, count })),
  byHex: new Map(Object.keys(entries).map((hex) => [hex, hex])),
  keptApart: true,
})
/** The bead colors the found colors deliver, none for an empty. */
const delivered = (found: ReturnType<typeof matchFoundColors>) => [...new Set(found.flatMap((color) => (color.result ? [color.result.hex] : [])))]

const catalog: ColorCatalog = {
  id: 'test',
  codes: [
    { code: 'DB1', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'], hex: '#d02020' },
    { code: 'DB2', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'], hex: '#ff0000', discontinued: true },
    { code: 'DB3', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['8/0'], hex: '#fe0101' },
    { code: 'DB4', family: ['Blue'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'], hex: '#2020d0' },
    { code: 'DB5', family: ['White'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
  ],
}

describe('Bead colors as a source', () => {
  it('offers the codes made in the Bead size, discontinued ones left out', () => {
    expect(beadColorTargets(catalog, '11/0', BUILT_IN_COLORS).map((target) => target.code)).toEqual(['DB1', 'DB4', 'DB5'])
  })

  it('snaps each found color to the nearest code, naming its family and Finish', () => {
    const [red] = matchFoundColors(reduced({ '#ff0000': 3 }), beadColorTargets(catalog, '11/0', BUILT_IN_COLORS), choices())
    expect(red!.match).toEqual({ hex: '#d02020', code: 'DB1', family: 'Red', finish: 'opaque' })
    expect(red!.result).toEqual(red!.match)
  })
})

describe('matchFoundColors', () => {
  it('snaps every found color to the Default Palette, most beads first', () => {
    const found = matchFoundColors(reduced({ '#0000ff': 1, '#ff0000': 4 }), defaults, choices())
    expect(found.map(({ pictureHex, count, result }) => [pictureHex, count, result?.colorId])).toEqual([
      ['#ff0000', 4, 'red'],
      ['#0000ff', 1, 'blue'],
    ])
  })

  it('keeps the picture’s own colors when matching to Exact', () => {
    const [color] = matchFoundColors(reduced({ '#123456': 2 }), undefined, choices())
    expect(color!.result).toEqual({ hex: '#123456' })
  })

  it('keeps a color exact, remaps one and empties one, after the snap', () => {
    const found = matchFoundColors(
      reduced({ '#ff0000': 3, '#00a000': 2, '#ffffff': 1 }),
      defaults,
      choices({
        '#ff0000': { kind: 'exact' },
        '#00a000': { kind: 'remap', target: { hex: '#2f6fed', colorId: 'blue' } },
        '#ffffff': { kind: 'empty' },
      }),
    )
    expect(found.map((color) => color.result)).toEqual([{ hex: '#ff0000' }, { hex: '#2f6fed', colorId: 'blue' }, undefined])
    expect(found[0]!.match.colorId).toBe('red')
  })

  it('keeps every remap and empty when the source changes, and matches the rest again', () => {
    const kept = choices({ '#00a000': { kind: 'remap', target: { hex: '#2f6fed', colorId: 'blue' } }, '#ffffff': { kind: 'empty' } })
    const picture = reduced({ '#ff0000': 3, '#00a000': 2, '#ffffff': 1 })
    const found = matchFoundColors(picture, beadColorTargets(catalog, '11/0', BUILT_IN_COLORS), kept)
    expect(found.map((color) => color.result?.code ?? color.result?.hex)).toEqual(['DB1', '#2f6fed', undefined])
  })
})

describe('beadColorRows (ticket 0863)', () => {
  it('joins the found colors that become the same bead color, most beads first', () => {
    const found = matchFoundColors(reduced({ '#0000ff': 2, '#1010f0': 3, '#ff0000': 4 }), defaults, choices())
    expect(beadColorRows(found).map(({ pictureHexes, count, result }) => [pictureHexes, count, result?.colorId])).toEqual([
      [['#1010f0', '#0000ff'], 5, 'blue'],
      [['#ff0000'], 4, 'red'],
    ])
  })

  it('keeps one row per color under Exact', () => {
    const found = matchFoundColors(reduced({ '#123456': 2, '#654321': 1 }), undefined, choices())
    expect(beadColorRows(found).map((row) => row.pictureHexes)).toEqual([['#123456'], ['#654321']])
  })

  it('joins the colors set to empty by the bead color they matched, so a row emptied stays one row', () => {
    const found = matchFoundColors(
      reduced({ '#0000ff': 2, '#1010f0': 3, '#ff0000': 4 }),
      defaults,
      choices({ '#0000ff': { kind: 'empty' }, '#1010f0': { kind: 'empty' } }),
    )
    const rows = beadColorRows(found)
    expect(rows.map(({ pictureHexes, result, choice }) => [pictureHexes, result?.colorId, choice?.kind])).toEqual([
      [['#1010f0', '#0000ff'], undefined, 'empty'],
      [['#ff0000'], 'red', undefined],
    ])
  })

  it('gives a row the choice its colors share, and none when they differ', () => {
    const blue = defaults!.find((target) => target.colorId === 'blue')!
    const found = matchFoundColors(reduced({ '#0000ff': 2, '#00a000': 3 }), defaults, choices({ '#00a000': { kind: 'remap', target: blue } }))
    const [row] = beadColorRows(found)
    expect(row!.pictureHexes).toEqual(['#00a000', '#0000ff'])
    expect(row!.choice).toBeUndefined()
  })
})

describe('convertFrame', () => {
  it('paints each cell the color its found color became, and leaves an emptied one without a bead', () => {
    const picture = reduced({ '#ff0000': 2, '#ffffff': 2 })
    const found = matchFoundColors(picture, defaults, choices({ '#ffffff': { kind: 'empty' } }))
    expect(convertFrame([['#ff0000', '#ffffff'], [undefined, '#ff0000']], picture, found)).toEqual([
      [{ color: '#e63746' }, { color: null }],
      [{ color: null }, { color: '#e63746' }],
    ])
  })
})

describe('newProjectPalette', () => {
  it('is the built-in colors, then every other color the beads use, most beads first', () => {
    const found = matchFoundColors(
      reduced({ '#ff0000': 1, '#123456': 5, '#abcdef': 3 }),
      undefined,
      choices({ '#ff0000': { kind: 'remap', target: { hex: '#e63746', colorId: 'red' } } }),
    )
    expect(newProjectPalette(BUILT_IN_COLORS, found)).toEqual({
      ids: [...BUILT_IN_COLORS.map((color) => color.id), addedColorId('#123456'), addedColorId('#abcdef')],
      codes: {},
    })
  })

  it('brings each Bead color’s code, a built-in hex too, and holds a merged color once', () => {
    const targets = beadColorTargets(catalog, '11/0', BUILT_IN_COLORS)
    const found = matchFoundColors(reduced({ '#ff0000': 4, '#ee1111': 2, '#fefefe': 1 }), targets, choices({ '#ee1111': { kind: 'remap', target: { hex: '#d02020', code: 'DB1' } } }))
    expect(newProjectPalette(BUILT_IN_COLORS, found)).toEqual({
      ids: [...BUILT_IN_COLORS.map((color) => color.id), addedColorId('#d02020')],
      codes: { '#d02020': 'DB1', '#ffffff': 'DB5' },
    })
  })

  it('adds nothing for an emptied color', () => {
    const found = matchFoundColors(reduced({ '#123456': 1 }), undefined, choices({ '#123456': { kind: 'empty' } }))
    expect(newProjectPalette(BUILT_IN_COLORS, found).ids).toEqual(BUILT_IN_COLORS.map((color) => color.id))
  })
})

// Ticket 0890: the least distance holds for what is delivered, after the match, so two look-alike codes never both come out.
describe('the least distance between delivered colors (ticket 0890)', () => {
  const apart = (hexes: readonly string[]) =>
    hexes.every((a) => hexes.every((b) => a === b || colorDistance(toOklab(channelsOf(a)), toOklab(channelsOf(b))) >= LEAST_COLOR_DISTANCE))

  const lookAlikes = [
    { hex: '#202020', code: 'DB10' },
    { hex: '#303030', code: 'DB2394' },
    { hex: '#e0e0e0', code: 'DB200' },
  ]
  // Two dark picture colors far enough apart to be kept, matching two black codes that look alike.
  const picture = reducedPicture({ '#1a1a1a': 50, '#383838': 20, '#e8e8e8': 10 })

  it('joins a found color whose code looks like a bigger one’s into it, with the Bead’s colors', () => {
    const found = matchFoundColors(picture, lookAlikes, choices())
    expect(found.map((color) => color.result?.code)).toEqual(['DB10', 'DB10', 'DB200'])
    expect(apart(delivered(found))).toBe(true)
  })

  it('keeps the colors apart with the Default Palette and with Exact too', () => {
    for (const targets of [defaults, undefined]) {
      const found = matchFoundColors(reducedPicture({ '#1a1a1a': 50, '#262626': 20, '#e8e8e8': 10 }), targets, choices())
      expect(found[1]!.result).toEqual(found[0]!.result)
      expect(apart(delivered(found))).toBe(true)
    }
  })

  it('shows the joined colors as one row of Color by color and one color of Beads needed', () => {
    const found = matchFoundColors(picture, lookAlikes, choices())
    expect(beadColorRows(found).map(({ pictureHexes, count, result }) => [pictureHexes, count, result?.code])).toEqual([
      [['#1a1a1a', '#383838'], 70, 'DB10'],
      [['#e8e8e8'], 10, 'DB200'],
    ])
    expect(newProjectPalette([], found).codes).toEqual({ '#202020': 'DB10', '#e0e0e0': 'DB200' })
  })

  it('leaves a picture kept as it is with its own colors, however alike', () => {
    const found = matchFoundColors(reduced({ '#1a1a1a': 50, '#383838': 20 }), lookAlikes, choices())
    expect(found.map((color) => color.result?.code)).toEqual(['DB10', 'DB2394'])
  })

  it('still lets the maker remap a color onto a look-alike', () => {
    const found = matchFoundColors(picture, lookAlikes, choices({ '#383838': { kind: 'remap', target: lookAlikes[1]! } }))
    expect(found.map((color) => color.result?.code)).toEqual(['DB10', 'DB2394', 'DB200'])
  })
})

// Ticket 0891: a color used by fewer beads than the minimum is no tube to buy; it joins the nearest color that stays.
describe('a color used by a handful of beads (ticket 0891)', () => {
  /** Soft edges: `steps` blends from one flat color to another, each used by `beads` beads. */
  const blends = (from: string, to: string, steps: number, beads: number): Record<string, number> => {
    const a = channelsOf(from)
    const b = channelsOf(to)
    const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0')
    return Object.fromEntries(
      Array.from({ length: steps }, (_, at) => {
        const t = (at + 1) / (steps + 1)
        return [`#${hex(a.r + (b.r - a.r) * t)}${hex(a.g + (b.g - a.g) * t)}${hex(a.b + (b.b - a.b) * t)}`, beads]
      }),
    )
  }

  it('joins a color under the minimum into the nearest color that stays', () => {
    const found = matchFoundColors(reducedPicture({ '#1a1a1a': 50, '#e8e8e8': 40, '#202080': 9, '#d03030': 10 }), undefined, choices())
    expect(found.map((color) => color.result?.hex)).toEqual(['#1a1a1a', '#e8e8e8', '#1a1a1a', '#d03030'])
  })

  it('makes the preview, the found colors, Color by color and Beads needed agree', () => {
    const picture = reducedPicture({ '#1a1a1a': 50, '#e8e8e8': 40, '#202080': 5 })
    const codes = [{ hex: '#202020', code: 'DB10' }, { hex: '#202080', code: 'DB5' }, { hex: '#e0e0e0', code: 'DB200' }]
    const found = matchFoundColors(picture, codes, choices())
    const black = found[0]!.result!
    expect(found[2]!.result).toEqual(codes[0])
    expect(beadColorRows(found).map(({ pictureHexes, count }) => [pictureHexes, count])).toEqual([
      [['#1a1a1a', '#202080'], 55],
      [['#e8e8e8'], 40],
    ])
    expect(convertFrame([['#202080', '#e8e8e8']], picture, found)).toEqual([[{ color: black.hex }, { color: found[1]!.result!.hex }]])
    expect(newProjectPalette([], found).codes).toEqual({ '#202020': 'DB10', '#e0e0e0': 'DB200' })
  })

  it('counts the beads of a code, so two small colors that match one code reaching the minimum stay', () => {
    const found = matchFoundColors(reducedPicture({ '#1a1a1a': 50, '#ff0000': 6, '#e00000': 6 }), [{ hex: '#202020' }, { hex: '#d02020' }], choices())
    expect(delivered(found)).toEqual(['#202020', '#d02020'])
  })

  it('gives a synthetic logo with soft edges at 12 colors its 5 colors', () => {
    const flat = { '#1a237e': 1200, '#2e7d32': 660, '#c62828': 560, '#ffffff': 280, '#fbc02d': 170 }
    const edges = {
      ...blends('#1a237e', '#ffffff', 4, 2),
      ...blends('#2e7d32', '#ffffff', 4, 1),
      ...blends('#c62828', '#ffffff', 4, 2),
      ...blends('#fbc02d', '#1a237e', 4, 1),
      ...blends('#c62828', '#2e7d32', 4, 1),
    }
    const found = matchFoundColors(reducePictureColors(new Map(Object.entries({ ...flat, ...edges })), 12), undefined, choices())
    expect(delivered(found)).toHaveLength(5)
  })

  it('gives synthetic lettering its 3 colors', () => {
    const lettering = { '#ffffff': 560, '#6d4c41': 100, '#d32f2f': 60, ...blends('#6d4c41', '#ffffff', 4, 2), ...blends('#d32f2f', '#ffffff', 4, 1), ...blends('#6d4c41', '#d32f2f', 3, 1) }
    const found = matchFoundColors(reducePictureColors(new Map(Object.entries(lettering)), 12), undefined, choices())
    expect(delivered(found)).toHaveLength(3)
  })

  it('keeps every color of pixel art, whose colors fit the count, however few beads use one', () => {
    const found = matchFoundColors(reduced({ '#1a1a1a': 50, '#e8e8e8': 40, '#ff0000': 1 }), defaults, choices())
    expect(delivered(found)).toHaveLength(3)
  })

  it('keeps a color the maker kept exact or changed, however few beads use it', () => {
    const picture = reducedPicture({ '#1a1a1a': 50, '#e8e8e8': 40, '#202080': 5, '#f0d0d0': 3 })
    const kept = matchFoundColors(picture, undefined, choices({ '#202080': { kind: 'exact' }, '#f0d0d0': { kind: 'remap', target: { hex: '#ff00ff' } } }))
    expect(kept.map((color) => color.result?.hex)).toEqual(['#1a1a1a', '#e8e8e8', '#202080', '#ff00ff'])
  })

  it('leaves the colors as they are when none reaches the minimum', () => {
    const found = matchFoundColors(reducedPicture({ '#1a1a1a': 5, '#e8e8e8': 4 }), undefined, choices())
    expect(delivered(found)).toEqual(['#1a1a1a', '#e8e8e8'])
  })
})

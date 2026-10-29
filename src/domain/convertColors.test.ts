// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ColorCatalog } from './colorCatalog'
import { BUILT_IN_COLORS, addedColorId } from './palette'
import { reducePictureColors } from './imageColors'
import {
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

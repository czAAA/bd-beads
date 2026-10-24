import { describe, expect, it } from 'vitest'
import { catalogSwatches, swatchHex } from './beadSwatch'
import { findBuiltInColor } from './palette'
import type { ColorCatalog } from './colorCatalog'

const code = (over: Record<string, unknown>) => ({ code: 'DB1', family: ['Blue'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'], ...over })
const catalog = (codes: unknown[]) => ({ id: 'x', codes }) as ColorCatalog

describe('swatchHex', () => {
  it('is the default color of the family for an opaque bead', () => {
    expect(swatchHex('Blue', 'opaque')).toBe(findBuiltInColor('blue')!.hex)
    expect(swatchHex('Gray', 'opaque')).toBe(findBuiltInColor('grey')!.hex)
  })

  it('changes the family by the Finish', () => {
    const base = swatchHex('Blue', 'opaque')!
    const finishes = ['transparent', 'ceylon', 'silver-lined', 'luster', 'matte', 'rainbow', 'metallic', 'plated'] as const
    const hexes = finishes.map((finish) => swatchHex('Blue', finish))
    expect(hexes.every((hex) => /^#[0-9a-f]{6}$/.test(hex!) && hex !== base)).toBe(true)
  })

  it('has no color for a mix or a family it does not know', () => {
    expect(swatchHex('Mix', 'opaque')).toBeUndefined()
    expect(swatchHex('Nonsense', 'opaque')).toBeUndefined()
  })
})

describe('catalogSwatches', () => {
  it('lists the codes of the size, with a generated hex marked approximate', () => {
    const list = catalogSwatches(catalog([code({}), code({ code: 'DB2', sizes: ['15/0'] })]), '11/0', [])
    expect(list).toEqual([{ code: 'DB1', family: 'Blue', finish: 'opaque', hex: swatchHex('Blue', 'opaque'), approximate: true, discontinued: false, taken: false }])
  })

  it('uses a measured hex as it is, not approximate', () => {
    const [entry] = catalogSwatches(catalog([code({ hex: '#123456' })]), '11/0', [])
    expect(entry).toMatchObject({ hex: '#123456', approximate: false })
  })

  it('marks a code whose hex is already in the Palette as taken, and one that is discontinued', () => {
    const blue = swatchHex('Blue', 'opaque')!
    const list = catalogSwatches(catalog([code({}), code({ code: 'DB2', family: ['Red'], discontinued: true })]), '11/0', [blue])
    expect(list.map((entry) => [entry.taken, entry.discontinued])).toEqual([[true, false], [false, true]])
  })

  it('takes the first family that has a color, and leaves out a code with none', () => {
    const list = catalogSwatches(catalog([code({ family: ['Mix', 'Red'] }), code({ code: 'DB2', family: ['Mix'] })]), '11/0', [])
    expect(list.map((entry) => [entry.code, entry.family])).toEqual([['DB1', 'Red']])
  })
})

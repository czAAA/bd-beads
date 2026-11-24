import { describe, expect, it } from 'vitest'
import { catalogSwatches, swatchHex } from './beadSwatch'
import { BUILT_IN_COLORS, findBuiltInColor } from './palette'
import type { ColorCatalog } from './colorCatalog'

const code = (over: Record<string, unknown>) => ({ code: 'DB1', family: ['Blue'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'], ...over })
const catalog = (codes: unknown[]) => ({ id: 'x', codes }) as ColorCatalog
/** The family colors of the catalog's Brand: here the twelve, as a Brand without a set of its own has. */
const families = BUILT_IN_COLORS

describe('swatchHex', () => {
  it('is the default color of the family for an opaque bead', () => {
    expect(swatchHex('Blue', 'opaque', families)).toBe(findBuiltInColor('blue')!.hex)
    expect(swatchHex('Gray', 'opaque', families)).toBe(findBuiltInColor('grey')!.hex)
  })

  it('changes the family by the Finish', () => {
    const base = swatchHex('Blue', 'opaque', families)!
    const finishes = ['transparent', 'ceylon', 'silver-lined', 'luster', 'matte', 'rainbow', 'metallic', 'plated'] as const
    const hexes = finishes.map((finish) => swatchHex('Blue', finish, families))
    expect(hexes.every((hex) => /^#[0-9a-f]{6}$/.test(hex!) && hex !== base)).toBe(true)
  })

  it('takes the family color from the Brand it is given, so each Brand\'s catalog gets its own (ADR 0078)', () => {
    const own = [{ id: 'blue', hex: '#1040a0' }]
    expect(swatchHex('Blue', 'opaque', own)).toBe('#1040a0')
    expect(swatchHex('Red', 'opaque', own)).toBeUndefined()
  })

  it('has no color for a mix or a family it does not know', () => {
    expect(swatchHex('Mix', 'opaque', families)).toBeUndefined()
    expect(swatchHex('Nonsense', 'opaque', families)).toBeUndefined()
  })
})

describe('catalogSwatches', () => {
  it('lists the codes of the size, with a generated hex marked approximate', () => {
    const list = catalogSwatches(catalog([code({}), code({ code: 'DB2', sizes: ['15/0'] })]), '11/0', [], families)
    expect(list).toEqual([{ code: 'DB1', family: 'Blue', finish: 'opaque', hex: swatchHex('Blue', 'opaque', families), approximate: true, discontinued: false }])
  })

  it('uses a measured hex as it is, not approximate', () => {
    const [entry] = catalogSwatches(catalog([code({ hex: '#123456' })]), '11/0', [], families)
    expect(entry).toMatchObject({ hex: '#123456', approximate: false })
  })

  it('marks a code that is discontinued', () => {
    const list = catalogSwatches(catalog([code({}), code({ code: 'DB2', family: ['Red'], discontinued: true })]), '11/0', [], families)
    expect(list.map((entry) => entry.discontinued)).toEqual([false, true])
  })

  it('names the Palette\'s swatch only on the row of the very code of this catalog it carries (tickets 1092, 1226)', () => {
    const twins = catalog([code({ hex: '#223a70' }), code({ code: 'DB2', family: ['Black'], hex: '#223a70' })])
    const held = (palette: Parameters<typeof catalogSwatches>[2]) => catalogSwatches(twins, '11/0', palette, families).map((entry) => entry.heldAs)
    expect(held([{ id: 'added-223a70', code: 'DB2', catalog: 'x' }])).toEqual([undefined, 'added-223a70'])
    expect(held([{ id: 'added-223a70' }])).toEqual([undefined, undefined])
    expect(held([{ id: 'added-223a70', code: 'DB2', catalog: 'toho' }])).toEqual([undefined, undefined])
  })

  it('leaves a code free when the Palette holds its color under another code: it is added a shade apart (ticket 1226)', () => {
    const twins = catalog([code({ hex: '#223a70' }), code({ code: 'DB2', family: ['Black'], hex: '#223a70' })])
    expect(catalogSwatches(twins, '11/0', [{ id: 'added-223a71', code: 'DB1', catalog: 'x' }], families).map((entry) => entry.heldAs)).toEqual(['added-223a71', undefined])
  })

  it('takes the first family that has a color, and leaves out a code with none', () => {
    const list = catalogSwatches(catalog([code({ family: ['Mix', 'Red'] }), code({ code: 'DB2', family: ['Mix'] })]), '11/0', [], families)
    expect(list.map((entry) => [entry.code, entry.family])).toEqual([['DB1', 'Red']])
  })
})

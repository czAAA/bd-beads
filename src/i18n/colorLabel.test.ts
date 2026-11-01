import { describe, expect, it } from 'vitest'
import type { ColorCatalog } from '../domain/colorCatalog'
import { addedColorId } from '../domain/palette'
import { colorLabel } from './colorLabel'
import { en } from './en'
import { ru } from './ru'

const catalog: ColorCatalog = {
  id: 'toho',
  codes: [
    { code: '49', family: ['Black'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: '2', family: ['Yellow', 'Brown'], finish: 'transparent', wording: 'Transparent', sizes: ['11/0'] },
  ],
}

describe('colorLabel (ticket 0760)', () => {
  it('names a catalog color by its code and the catalog\'s name for it, with the hex for the Tooltip', () => {
    expect(colorLabel(en, { id: addedColorId('#1a1a1a'), hex: '#1a1a1a', code: '49' }, catalog)).toEqual({ text: '49 Opaque Black', hex: '#1A1A1A' })
  })

  it('names a code by its first color family', () => {
    expect(colorLabel(en, { hex: '#c8a000', code: '2' }, catalog).text).toBe('2 Transparent Yellow')
  })

  it('takes the family and Finish the place already knows, with no catalog', () => {
    expect(colorLabel(en, { hex: '#1a1a1a', code: '49', family: 'Black', finish: 'matte' }).text).toBe('49 Matte Black')
  })

  it('is the code alone while the catalog has not loaded, or does not list it', () => {
    expect(colorLabel(en, { hex: '#1a1a1a', code: '49' })).toEqual({ text: '49', hex: '#1A1A1A' })
    expect(colorLabel(en, { hex: '#1a1a1a', code: '999' }, catalog).text).toBe('999')
  })

  it('puts the name in the language\'s own order and words', () => {
    expect(colorLabel(ru, { hex: '#1a1a1a', code: '49' }, catalog).text).toBe(`49 ${ru.colorNames.black} · ${ru.palette.beadColors.finishes.opaque}`)
  })

  it('names a Palette color without a code by its Palette name, hex in the Tooltip', () => {
    expect(colorLabel(en, { id: 'red', hex: '#e63746' })).toEqual({ text: 'Red', hex: '#E63746' })
  })

  it('shows a Custom color, which has no name, as its hex and nothing for a Tooltip', () => {
    expect(colorLabel(en, { id: addedColorId('#123456'), hex: '#123456' })).toEqual({ text: '#123456' })
    expect(colorLabel(en, { hex: '#abcdef' })).toEqual({ text: '#ABCDEF' })
  })
})

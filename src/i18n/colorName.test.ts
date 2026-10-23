import { describe, expect, it } from 'vitest'
import { addedColorId } from '../domain/palette'
import { colorName, listedColorName } from './colorName'
import { en } from './en'
import { ru } from './ru'

describe('listedColorName (ticket 0530)', () => {
  it('names a Palette color, and gives the hex for an added or unknown one so they stay told apart', () => {
    expect(listedColorName(en, { id: 'red', hex: '#e63746' }, '#e63746')).toBe('Red')
    expect(listedColorName(en, { id: addedColorId('#123456'), hex: '#123456' }, '#123456')).toBe('#123456')
    expect(listedColorName(en, undefined, '#abcdef')).toBe('#ABCDEF')
  })
})

describe('colorName (ticket 0530)', () => {
  it('translates a generic color in each language', () => {
    expect(colorName(en, { id: 'red', hex: '#e63746' })).toBe('Red')
    expect(colorName(ru, { id: 'red', hex: '#e63746' })).toBe(ru.colorNames.red)
  })

  it('gives a brand\'s literal name as it is, in every language', () => {
    const color = { id: 'brand-a', hex: '#102030', literalName: 'Ocean 7' }
    expect(colorName(en, color)).toBe('Ocean 7')
    expect(colorName(ru, color)).toBe('Ocean 7')
  })

  it('says Custom color for an added color or a color the Palette lacks', () => {
    expect(colorName(en, { id: addedColorId('#123456'), hex: '#123456' })).toBe('Custom color')
    expect(colorName(en, undefined)).toBe('Custom color')
  })
})

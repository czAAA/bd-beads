import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { MAX_IMAGE_COLORS } from '../../domain/imageConversion'
import { insideRows } from './insideCopy'

describe("What's inside's copy (ticket 0797)", () => {
  it('lists the 13 rows in the order the tour plays them, each with the icon the editor uses for it', () => {
    expect(insideRows(en, 'en').map(({ id, icon }) => [id, icon])).toEqual([
      ['canvas', 'select'],
      ['techniques', 'grid'],
      ['editing', 'paint'],
      ['mirror', 'mirror'],
      ['reference', 'reference-image'],
      ['convert', 'image'],
      ['colors', 'palette'],
      ['letters', 'pattern'],
      ['starters', 'frame'],
      ['rowProgress', 'turn-row-direction'],
      ['beadsNeeded', 'bead'],
      ['exports', 'export'],
      ['savedProjects', 'library'],
    ])
  })

  it("takes Convert image's most colors and the catalogs' brands from the app", () => {
    const rows = insideRows(en, 'en')
    expect(rows.find((row) => row.id === 'convert')!.text).toBe(`A picture into a Schema, in up to ${MAX_IMAGE_COLORS} colors.`)
    expect(rows.find((row) => row.id === 'colors')!.text).toBe('TOHO and Miyuki, and a Palette of your own.')
    expect(insideRows(ru, 'ru').find((row) => row.id === 'colors')!.text).toBe('TOHO и Miyuki и ваша собственная палитра.')
  })
})

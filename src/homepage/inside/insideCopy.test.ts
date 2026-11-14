import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { MAX_IMAGE_COLORS } from '../../domain/imageConversion'
import { INSIDE_ROWS, insideChapters } from './insideCopy'
import type { Translations } from '../../i18n/translations'

/** The rows as the chapters hold them, in order. */
const rowsOf = (t: Translations, locale: 'en' | 'ru') => insideChapters(t, locale).flatMap((chapter) => chapter.rows)

describe("What's inside's copy (ticket 0797)", () => {
  it('lists the 13 rows in the order the tour plays them, each with the icon the editor uses for it', () => {
    expect(rowsOf(en, 'en').map(({ id, icon }) => [id, icon])).toEqual([
      ['canvas', 'select'],
      ['techniques', 'grid'],
      ['editing', 'paint'],
      ['mirror', 'mirror'],
      ['convert', 'image'],
      ['starters', 'frame'],
      ['reference', 'reference-image'],
      ['colors', 'palette'],
      ['letters', 'pattern'],
      ['rowProgress', 'turn-row-direction'],
      ['beadsNeeded', 'bead'],
      ['exports', 'export'],
      ['savedProjects', 'library'],
    ])
  })

  it("takes Convert image's most colors and the catalogs' brands from the app", () => {
    const rows = rowsOf(en, 'en')
    expect(rows.find((row) => row.id === 'convert')!.text).toBe(`A picture into a Schema, in up to ${MAX_IMAGE_COLORS} colors.`)
    expect(rows.find((row) => row.id === 'colors')!.text).toBe('TOHO and Miyuki, and a Palette of your own.')
    expect(rowsOf(ru, 'ru').find((row) => row.id === 'colors')!.text).toBe('TOHO и Miyuki и ваша собственная палитра.')
  })

  it('groups the rows into four chapters in tour order, each with its icon and name (ticket 0830)', () => {
    expect(insideChapters(en, 'en').map(({ id, icon, name, rows }) => [id, icon, name, rows.map((row) => row.id)])).toEqual([
      ['draw', 'paint', 'Draw', ['canvas', 'techniques', 'editing', 'mirror']],
      ['startFrom', 'image', 'Start from something', ['convert', 'starters', 'reference']],
      ['beadColors', 'palette', 'Real bead colors', ['colors', 'letters']],
      ['weaveKeep', 'turn-row-direction', 'Weave and keep', ['rowProgress', 'beadsNeeded', 'exports', 'savedProjects']],
    ])
    // Every row is in a chapter, in the order the tour plays them.
    expect(insideChapters(en, 'en').flatMap(({ rows }) => rows.map((row) => row.id))).toEqual(INSIDE_ROWS.map((row) => row.id))
  })

  it("describes a chapter by its rows' names, joined as the language joins a list (ticket 0830)", () => {
    expect(insideChapters(en, 'en')[1]!.describes).toBe('Convert image, Starters, and Reference image')
    expect(insideChapters(ru, 'ru')[2]!.describes).toBe('Цвета внутри и Буквы')
  })
})

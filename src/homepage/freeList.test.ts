import { describe, expect, it } from 'vitest'
import { freeListRows } from './freeList'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { groupThousands } from '../domain/formatNumber'
import toho from '../data/colorCatalogs/toho.json'
import delica from '../data/colorCatalogs/miyuki-delica.json'
import round from '../data/colorCatalogs/miyuki-round.json'

/** Every code the built-in catalogs hold, counted from their files. */
const CODES = [toho, delica, round].reduce((sum, catalog) => sum + catalog.codes.length, 0)

describe('the free list (ticket 0742)', () => {
  it('names the app’s real features in the design system’s order, 17 rows', () => {
    const rows = freeListRows(en, 'en')
    expect(rows).toHaveLength(17)
    expect(rows[0]).toBe('Runs in your browser, and your work stays on your device')
    expect(rows[3]).toBe('As many Projects as you like')
  })

  it('reads the Techniques and their names from the app', () => {
    expect(freeListRows(en, 'en')[2]).toBe('3 Techniques: loom, peyote, and brick stitch')
  })

  it('reads the Color catalogs’ brands and how many codes they hold together', () => {
    expect(freeListRows(en, 'en')[12]).toBe(`TOHO and Miyuki colors built in, ${groupThousands(CODES, 'en')} of them`)
  })

  it('reads how many Starters there are and their categories', () => {
    expect(freeListRows(en, 'en')[16]).toBe('15 Starters for shapes, earrings, rings, and bands')
  })

  it('says it in Russian, the counted words in their forms', () => {
    const rows = freeListRows(ru, 'ru')
    expect(rows[2]).toBe('3 техники: ткачество, мозаичное плетение и кирпичное плетение')
    expect(rows[12]).toBe(`Цвета TOHO и Miyuki уже внутри, ${groupThousands(CODES, 'ru')} штук`)
    expect(rows[16]).toBe('15 стартеров: фигуры, серьги, кольца и браслеты')
  })
})

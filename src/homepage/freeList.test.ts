import { describe, expect, it } from 'vitest'
import { freeListGroups, freeListRows } from './freeList'
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

describe('the free list in the four chapters (ticket 0947)', () => {
  it('stands in What\'s inside\'s four chapters, with their names and icons', () => {
    expect(freeListGroups(en, 'en').map(({ id, icon, name }) => [id, icon, name])).toEqual([
      ['draw', 'paint', 'Draw'],
      ['startFrom', 'image', 'Start from something'],
      ['beadColors', 'palette', 'Real bead colors'],
      ['weaveKeep', 'turn-row-direction', 'Weave and keep'],
    ])
  })

  it('holds every row of the list once, none left out', () => {
    const grouped = freeListGroups(en, 'en').flatMap((group) => group.rows)
    expect([...grouped].sort()).toEqual([...freeListRows(en, 'en')].sort())
  })

  it('puts each row in the chapter it is shown in', () => {
    const [draw, startFrom, beadColors, weaveKeep] = freeListGroups(en, 'en')
    expect(draw!.rows[0]).toBe('An open Canvas: draw anywhere, it has no edges')
    expect(startFrom!.rows).toEqual(['Turn a picture into beads', '15 Starters for shapes, earrings, rings, and bands'])
    expect(beadColors!.rows[0]).toBe(`TOHO and Miyuki colors built in, ${groupThousands(CODES, 'en')} of them`)
    expect(weaveKeep!.rows[0]).toBe('Row progress: mark rows done as you weave')
  })
})

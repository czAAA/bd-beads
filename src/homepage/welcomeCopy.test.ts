import { describe, expect, it } from 'vitest'
import { groupThousands } from '../domain/formatNumber'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import toho from '../data/colorCatalogs/toho.json'
import delica from '../data/colorCatalogs/miyuki-delica.json'
import round from '../data/colorCatalogs/miyuki-round.json'
import { welcomeCaption, welcomeCounts, welcomePromises } from './welcomeCopy'

/** Every code the built-in catalogs hold, counted from their files. */
const CODES = [toho, delica, round].reduce((sum, catalog) => sum + catalog.codes.length, 0)

describe("the Welcome section's words (ticket 0830)", () => {
  it('counts the bead colors, their brands and the Starters from the app', () => {
    expect(welcomeCounts(en, 'en')).toBe(`${groupThousands(CODES, 'en')} TOHO and Miyuki colors · 15 Starters`)
  })

  it("picks each count's form in Russian", () => {
    expect(welcomeCounts(ru, 'ru')).toBe(`${groupThousands(CODES, 'ru')} цветов TOHO и Miyuki · 15 стартеров`)
  })

  it("names the piece by its Technique and its grid's size", () => {
    expect(welcomeCaption(en)).toBe('Peyote · 48×23')
    expect(welcomeCaption(ru)).toBe('Мозаичное плетение · 48×23')
  })

  it("keeps three of the coffee screen's promises, with its icons and lines", () => {
    const promises = welcomePromises(en)
    expect(promises.map(({ icon, name }) => [icon, name])).toEqual([
      ['device', 'Yours, on this device'],
      ['cloud-off', 'Works offline'],
      ['check', 'Free forever'],
    ])
    expect(promises[1]!.text).toBe('Once open, it keeps working without a connection.')
  })
})

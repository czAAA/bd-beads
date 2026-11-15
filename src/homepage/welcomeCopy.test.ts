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

  it('promises free and local as one, then what the app does, in its chapter words (ticket 0946)', () => {
    const promises = welcomePromises(en)
    expect(promises.map(({ icon, name }) => [icon, name])).toEqual([
      ['check', 'Everything here is free'],
      ['image', 'Start from a picture'],
      ['turn-row-direction', 'Count and weave'],
    ])
    expect(promises[0]!.text).toBe('No account, no trial. Your work stays in this browser.')
  })

  it('never qualifies free with "for now" or "later"', () => {
    const words = welcomePromises(en).map(({ name, text }) => `${name} ${text}`).join(' ')
    expect(words).not.toMatch(/for now|later/i)
  })
})

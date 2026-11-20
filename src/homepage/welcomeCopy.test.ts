import { describe, expect, it } from 'vitest'
import { moveToRow } from '../domain/rowProgress'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { be } from '../i18n/be'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import { wovenCuff } from './inside/demoProjects'
import { cuffName, welcomeHeading, welcomeLine, welcomePromises } from './welcomeCopy'

describe("the Welcome section's words (tickets 0830, 1157)", () => {
  it('says what openbeads is and how many Techniques it works in, the count a word in the counted form', () => {
    expect(welcomeHeading(en, 'en')).toBe('A free bead pattern editor that works in three techniques')
    expect(welcomeHeading(ru, 'ru')).toBe('Бесплатный редактор схем для плетения бисером, работающий в трёх техниках')
  })

  it('counts the Techniques in every language, never the digit while it has a word for it', () => {
    const strings = { en, ru, uk, be, zh, es, pl } as const
    for (const [locale, t] of Object.entries(strings)) {
      const heading = welcomeHeading(t, locale as keyof typeof strings)
      expect(heading, locale).not.toMatch(/\d|\{/)
    }
  })

  it('lists the Techniques by name in the line, the first capitalised', () => {
    expect(welcomeLine(en, 'en')).toBe('Loom, peyote, and brick stitch.')
    expect(welcomeLine(ru, 'ru')).toBe('Ткачество, мозаичное плетение и кирпичное плетение.')
    expect(welcomeLine(zh, 'zh')).toBe('织机、佩奥和砖形。')
  })

  it('promises free and local as one, then what the app does, then free export (ticket 1157)', () => {
    const promises = welcomePromises(en)
    expect(promises.map(({ icon, name }) => [icon, name])).toEqual([
      ['check', 'Everything here is free'],
      ['image', 'Start from a picture'],
      ['turn-row-direction', 'Count and weave'],
      ['export', 'Free export'],
    ])
    expect(promises[0]!.text).toBe('No account, no trial. Your work stays in this browser.')
    expect(promises[3]!.text).toBe('PDF and PNG in full quality.')
  })

  it('never qualifies free with "for now" or "later"', () => {
    const words = welcomePromises(en).map(({ name, text }) => `${name} ${text}`).join(' ')
    expect(words).not.toMatch(/for now|later/i)
  })

  it("names the cuff with the counter's own words", () => {
    expect(cuffName(en, moveToRow(wovenCuff(), 6))).toBe('Peacock feather cuff in peyote, being woven: Pass 7 of 95, row 4')
  })
})

import { describe, expect, it } from 'vitest'
import { LOCALES } from '../domain/locale'
import { be } from '../i18n/be'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { pl } from '../i18n/pl'
import { ru } from '../i18n/ru'
import { uk } from '../i18n/uk'
import { zh } from '../i18n/zh'
import { freeListGroups } from './freeList'
import { insideChapters } from './inside/insideCopy'
import { homepageCopy, homepageTitle } from './pageCopy'
import { welcomePromises } from './welcomeCopy'

describe('the Homepage’s words as its page carries them (ticket 1055)', () => {
  it('has a title in the words people search with, ending on the app’s name, which the tab shows too', () => {
    const title = homepageTitle(en)
    expect(title).toMatch(/bead pattern maker/i)
    for (const word of ['free', 'loom', 'peyote', 'brick stitch']) expect(title.toLowerCase()).toContain(word)
    expect(title.endsWith(' · openbeads')).toBe(true)
    expect(homepageCopy(en, 'en').title).toBe(title)
  })

  it('has a description that names the Techniques and says it is free, short enough for a search result', () => {
    const { description } = homepageCopy(en, 'en')
    for (const word of ['free', 'loom', 'peyote', 'brick stitch', 'bead pattern']) expect(description.toLowerCase()).toContain(word)
    // Longer is cut off in a search result, in every language.
    const strings = { en, ru, uk, be, zh, es, pl }
    for (const locale of LOCALES) expect(strings[locale].homepage.description.length, locale).toBeLessThanOrEqual(160)
  })

  it('holds the copy the drawn sections show, from the functions they draw from, and nothing else', () => {
    const [welcome, inside, free] = homepageCopy(en, 'en').sections
    expect(welcome).toEqual({
      heading: en.homepage.welcome.heading,
      line: en.homepage.welcome.line,
      named: welcomePromises(en).map(({ name, text }) => ({ name, text })),
    })
    expect(inside!.heading).toBe(en.homepage.whatsInside)
    expect(inside!.groups).toEqual(
      insideChapters(en, 'en').map((chapter) => ({ heading: chapter.name, named: chapter.rows.map(({ name, text }) => ({ name, text })) })),
    )
    expect(free!.heading).toBe(en.homepage.plans.alone.heading)
    expect(free!.groups).toEqual(freeListGroups(en, 'en').map((group) => ({ heading: group.name, rows: group.rows })))
  })
})

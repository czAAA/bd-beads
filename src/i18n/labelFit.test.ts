import { describe, expect, it } from 'vitest'
import { textWidth } from '../testUtils/textWidth'
import { be } from './be'
import { en } from './en'
import { es } from './es'
import { pl } from './pl'
import { ru } from './ru'
import { uk } from './uk'
import { zh } from './zh'
import type { Locale, Translations } from './translations'

// Does a label fit the box its place gives it, in every language (ticket 552)? Fast and with no page: the width
// comes from the bundled fonts (`textWidth`), the room from the CSS of the place, written down here with where it
// comes from. It covers the labels whose room is a known number; everything else is the component tests' job.
const ALL: Record<Locale, Translations> = { en, ru, uk, be, zh, es, pl }

interface Style {
  size: number
  weight: number
}
interface Budget {
  name: string
  /** Where the room comes from, so a change to that CSS finds this number. */
  room: { px: number; source: string }
  /** How many lines the place allows. */
  lines: number
  style: Style
  texts: (t: Translations) => Record<string, string>
}

/** The Overview carousel's list column from 1024 (FeatureCarousel.vue): 18.75rem wide, 14px padding each side, a 1.75rem
 * icon and a 10px gap before the text. */
const CAROUSEL_TEXT_ROOM = 300 - 2 * 14 - 28 - 10

const BUDGETS: Budget[] = [
  {
    name: 'carousel tab name',
    room: { px: CAROUSEL_TEXT_ROOM, source: 'FeatureCarousel.vue .carousel__tab, --type-title' },
    lines: 1,
    style: { size: 16, weight: 600 },
    texts: (t) => Object.fromEntries(Object.entries(t.overview.features).map(([key, copy]) => [key, copy.tabName ?? copy.name])),
  },
  {
    name: 'carousel tab line',
    room: { px: CAROUSEL_TEXT_ROOM, source: 'FeatureCarousel.vue .carousel__tab-line, --type-body, two lines (MORE_LINES in textFit)' },
    lines: 2,
    style: { size: 14, weight: 400 },
    texts: (t) => Object.fromEntries(Object.entries(t.overview.features).map(([key, copy]) => [key, copy.tabLine ?? copy.text])),
  },
]

/** Labels known not to fit yet, each deleted by the ticket that fixes it; an entry that fits again fails until it is
 * removed (the same rule as the e2e check's `textFitPending.ts`, ticket 229). */
const PENDING: { budget: string; key: string; locales: Locale[]; fixedBy: string }[] = [
  { budget: 'carousel tab line', key: 'projectEditing', locales: ['ru'], fixedBy: '231' },
  { budget: 'carousel tab line', key: 'rowProgress', locales: ['ru'], fixedBy: '231' },
]

const LOCALES = Object.keys(ALL) as Locale[]
const isPending = (budget: string, key: string, locale: Locale) => PENDING.some((entry) => entry.budget === budget && entry.key === key && entry.locales.includes(locale))

describe('labels fit their room', () => {
  for (const budget of BUDGETS) {
    it(`${budget.name}: every key in every language fits ${budget.lines} line(s) of ${budget.room.px}px`, () => {
      const misfits: string[] = []
      for (const locale of LOCALES) {
        for (const [key, text] of Object.entries(budget.texts(ALL[locale]))) {
          const { width } = textWidth(text, budget.style)
          const over = width - budget.lines * budget.room.px
          if (over > 0 && !isPending(budget.name, key, locale)) misfits.push(`${locale} ${key}: "${text}" is ${Math.round(over)}px past ${budget.lines} line(s) of ${budget.room.px}px (${budget.room.source})`)
        }
      }
      expect(misfits).toEqual([])
    })
  }

  it('no pending entry fits already', () => {
    const stale = PENDING.filter((entry) => {
      const budget = BUDGETS.find((candidate) => candidate.name === entry.budget)!
      return entry.locales.some((locale) => {
        const text = budget.texts(ALL[locale])[entry.key]
        return text !== undefined && textWidth(text, budget.style).width <= budget.lines * budget.room.px
      })
    })
    expect(stale.map((entry) => `${entry.budget} ${entry.key} (fixed by ${entry.fixedBy}): fits now, remove it from PENDING`)).toEqual([])
  })
})

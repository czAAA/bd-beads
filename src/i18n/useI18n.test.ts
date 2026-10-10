import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { provideI18n, type I18n } from './useI18n'
import { LOCALES } from '../domain/locale'
import { en } from './en'
import { es } from './es'
import { pl } from './pl'
import { ru } from './ru'
import { zh } from './zh'

const dictionaries = { en, ru, zh, es, pl }

beforeEach(() => {
  localStorage.clear()
})

describe('provideI18n', () => {
  it('keeps lang on <html> in step with the app language', async () => {
    let i18n: I18n | undefined
    mount(
      defineComponent({
        setup() {
          i18n = provideI18n()
          return () => null
        },
      }),
    )
    expect(document.documentElement.lang).toBe('en')

    i18n!.setLocale('ru')
    await nextTick()
    expect(document.documentElement.lang).toBe('ru')
  })
})

describe('copy rules (writing.md)', () => {
  it.each(LOCALES)('has no em dash in any %s string', (locale) => {
    const dictionary = dictionaries[locale]
    expect(JSON.stringify(dictionary)).not.toContain('—')
  })

  it('has a dictionary for every language, each with its own name for the switcher', () => {
    for (const locale of LOCALES) {
      const dictionary = dictionaries[locale]
      expect(Object.keys(dictionary.languageSwitcher.names)).toEqual([...LOCALES])
    }
  })

  it('gives a counted word the forms its language needs', () => {
    for (const locale of LOCALES) {
      const dictionary = dictionaries[locale]
      const needed = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
      for (const forms of [dictionary.canvas.piecesCount, dictionary.print.beadsCount, dictionary.a11y.colorsCount]) {
        for (const category of needed) {
          expect(forms, `${locale} ${category}`).toHaveProperty(category)
        }
      }
    }
  })
})

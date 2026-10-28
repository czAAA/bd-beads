import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { forgetLoadedLocales, loadLocale, provideI18n, type I18n } from './useI18n'
import { LOCALES } from '../domain/locale'
import { en } from './en'
import { es } from './es'
import { pl } from './pl'
import { ru } from './ru'
import { uk } from './uk'
import { be } from './be'
import { zh } from './zh'

const dictionaries = { en, ru, uk, be, zh, es, pl }

beforeEach(() => {
  localStorage.clear()
})

/** Mounts a root that provides the language, and hands it back. */
function mountI18n(): I18n {
  let i18n: I18n | undefined
  mount(
    defineComponent({
      setup() {
        i18n = provideI18n()
        return () => null
      },
    }),
  )
  return i18n!
}

describe('provideI18n', () => {
  it('keeps lang on <html> in step with the app language', async () => {
    const i18n = mountI18n()
    expect(document.documentElement.lang).toBe('en')

    i18n.setLocale('ru')
    await nextTick()
    expect(document.documentElement.lang).toBe('ru')
  })

  describe('a language not fetched yet (ticket 0616)', () => {
    beforeEach(async () => {
      forgetLoadedLocales()
      await loadLocale('en')
    })
    afterEach(async () => {
      await Promise.all(LOCALES.map(loadLocale))
    })

    it('keeps showing the language in use until the chosen one arrives, then shows it', async () => {
      const i18n = mountI18n()

      i18n.setLocale('ru')
      expect(i18n.locale.value).toBe('en')
      expect(i18n.t.value).toBe(en)

      await vi.waitFor(() => expect(i18n.t.value).toBe(ru))
      expect(i18n.locale.value).toBe('ru')
    })

    it('shows the language chosen last, though one chosen before it arrives later', async () => {
      const i18n = mountI18n()

      i18n.setLocale('ru')
      i18n.setLocale('en')
      await loadLocale('ru')

      expect(i18n.locale.value).toBe('en')
      expect(i18n.t.value).toBe(en)
    })
  })
})

describe('copy rules (writing.md)', () => {
  it.each(LOCALES)('has no em dash in any %s string', (locale) => {
    const dictionary = dictionaries[locale]
    expect(JSON.stringify(dictionary)).not.toContain('—')
  })

  it('gives a counted word the forms its language needs', () => {
    for (const locale of LOCALES) {
      const dictionary = dictionaries[locale]
      const needed = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
      for (const forms of [dictionary.print.beadsCount, dictionary.a11y.colorsCount]) {
        for (const category of needed) {
          expect(forms, `${locale} ${category}`).toHaveProperty(category)
        }
      }
    }
  })
})

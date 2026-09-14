import { type ComputedRef, type InjectionKey, type Ref, computed, inject, provide, ref } from 'vue'
import { en } from './en'
import { ru } from './ru'
import { loadLocale, saveLocale } from './localeStorage'
import type { Locale, Translations } from './translations'

export interface I18n {
  locale: Ref<Locale>
  setLocale: (locale: Locale) => void
  t: ComputedRef<Translations>
}

const dictionaries: Record<Locale, Translations> = { en, ru }
const I18N_KEY: InjectionKey<I18n> = Symbol('i18n')

function createI18n(): I18n {
  const locale = ref<Locale>(loadLocale())

  function setLocale(next: Locale) {
    locale.value = next
    saveLocale(next)
  }

  return { locale, setLocale, t: computed(() => dictionaries[locale.value]) }
}

/** Call once, at the root of the component tree, so descendants share one language via useI18n(). */
export function provideI18n(): I18n {
  const i18n = createI18n()
  provide(I18N_KEY, i18n)
  return i18n
}

/** Falls back to a standalone instance when mounted without an ancestor provideI18n() (e.g. in isolated component tests). */
export function useI18n(): I18n {
  return inject(I18N_KEY) ?? createI18n()
}

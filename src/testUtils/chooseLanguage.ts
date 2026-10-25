import type { VueWrapper } from '@vue/test-utils'
import type { Locale } from '../domain/locale'
import { choosePanelOption } from './choosePanelOption'

/** Picks a language from the Menu's Language picker: opens its list, then presses the language's item (ticket 368). */
export async function chooseLanguage(wrapper: Pick<VueWrapper, 'find'>, locale: Locale): Promise<void> {
  await choosePanelOption(wrapper, 'language-switcher', locale)
}

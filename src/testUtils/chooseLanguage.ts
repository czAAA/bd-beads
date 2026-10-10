import type { VueWrapper } from '@vue/test-utils'
import type { Locale } from '../domain/locale'

/** Picks a language from the switcher's list: opens the list, then presses the language's item (ticket 368). */
export async function chooseLanguage(wrapper: Pick<VueWrapper, 'find'>, locale: Locale): Promise<void> {
  await wrapper.find('[data-testid="language-switcher"]').trigger('click')
  await wrapper.find(`[data-testid="language-${locale}"]`).trigger('click')
}

import { onScopeDispose } from 'vue'
import type { Locale } from '../../domain/locale'
import { updateSummary } from '../../domain/waitingBuild'
import { whatsNewUrl } from '../../homepage/homepageRoute'
import type { Translations } from '../../i18n/translations'
import type { AppUpdates } from '../../services/offlineShell'
import type { useToasts } from '../ui/useToasts'

export interface UpdatePromptDeps {
  updates: AppUpdates
  messages: () => Translations
  locale: () => Locale
  showToast: ReturnType<typeof useToasts>['show']
}

// "Update ready" (ticket 69, ADR 0045): once a newer version has downloaded behind the open page, a quiet toast names
// the Version that waits and what it brings (ticket 1048), with Reload and What's new, and stays until answered or
// closed. Nothing reloads by itself, so an update never takes the person's place on the canvas.
export function useUpdatePrompt({ updates, messages, locale, showToast }: UpdatePromptDeps) {
  // What's new is a link: the editor keeps every change as it is made, so it leaves with nothing to do first.
  const leave = () => {}
  const stopListening = updates.onReady(locale, (waits) => {
    const t = messages()
    showToast(
      'update-ready',
      t.shell.updateReady,
      'info',
      { label: t.shell.updateReload, run: updates.apply },
      { persistent: true, secondAction: { label: t.homepage.whatsNew.name, href: whatsNewUrl(import.meta.env.BASE_URL), run: leave }, update: updateSummary(waits) },
    )
  })
  onScopeDispose(stopListening)
}

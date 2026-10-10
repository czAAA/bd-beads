import { onScopeDispose } from 'vue'
import type { Translations } from '../../i18n/translations'
import type { AppUpdates } from '../../services/offlineShell'
import type { useToasts } from '../ui/useToasts'

export interface UpdatePromptDeps {
  updates: AppUpdates
  messages: () => Translations
  showToast: ReturnType<typeof useToasts>['show']
}

/**
 * "Update ready" (ticket 69, ADR 0045): when a newer version of the app has downloaded behind the open page, a quiet
 * toast offers Reload and stays until answered or closed. Nothing reloads by itself, so an update never takes the
 * person's place on the canvas; the version also arrives on the next full load.
 */
export function useUpdatePrompt({ updates, messages, showToast }: UpdatePromptDeps) {
  const stopListening = updates.onReady(() => {
    const t = messages()
    showToast('update-ready', t.shell.updateReady, 'info', { label: t.shell.updateReload, run: updates.apply }, { persistent: true })
  })
  onScopeDispose(stopListening)
}

import { onScopeDispose } from 'vue'
import type { Translations } from '../../i18n/translations'
import type { AppSignIn } from '../../services/offlineShell'
import type { useToasts } from '../ui/useToasts'

export interface SignInPromptDeps {
  signIn: AppSignIn
  messages: () => Translations
  showToast: ReturnType<typeof useToasts>['show']
}

/** The host's sign-in has run out under an app opened from the device, where its sign-in page is never met (ticket
 * 1041, ADR 0045): a toast that stays offers Sign in. Without it the check for a newer version and Send feedback fail
 * with nothing saying why. */
export function useSignInPrompt({ signIn, messages, showToast }: SignInPromptDeps) {
  const stopListening = signIn.onRunOut(() => {
    const t = messages()
    showToast('sign-in', t.shell.signInRunOut, 'info', { label: t.shell.signIn, run: signIn.signIn }, { persistent: true })
  })
  onScopeDispose(stopListening)
}

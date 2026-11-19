import { onScopeDispose, ref, type Ref } from 'vue'
import { waitOf, type Account, type SignInRefusal } from '../../domain/account'
import { fillBlanks } from '../../domain/fillBlanks'
import type { Translations } from '../../i18n/translations'
import type { AccountService, SignInUnavailable } from '../../services/account'
import type { Verification } from '../../services/turnstile'
import type { MessageTone } from '../ui/useToasts'
import { useDialogs, type Dialogs } from './useDialogs'
import { useKeptSettings, type DeviceSettingControls } from './useKeptSettings'

/** What signing in needs from the app shell. */
export interface AccountFlowDeps {
  account: AccountService
  messages: () => Translations
  showToast: (id: string, text: string, tone?: MessageTone) => void
  /** Opens the Menu on its Account section, or straight on the Sign in Subpanel. */
  openMenu: (on: 'account' | 'sign-in') => void
  /** The panel sections folded on this device, by id (`usePanelSection`). */
  foldedSections: Ref<readonly string[]>
  /** The device's language, theme and Lifted pieces, which a signed-in person finds the same on all their devices
   * (ticket 1086): each as it shows now, and set the way the Menu sets it. */
  settings: DeviceSettingControls
  /** The shell's dialog registry, which shows "Delete your account?"; a test's flow makes its own. */
  dialogs?: Dialogs
}

/** The Account section's id among the Menu's folding sections. */
export const ACCOUNT_SECTION = 'menu:account'

/** How long a Turnstile token is used after it was given out: Cloudflare takes one for 300 seconds. */
const TOKEN_FRESH_MS = 240_000
/** One toast for "unavailable" and "offline": showing it again replaces it (Message card). */
const UNAVAILABLE_TOAST = 'account-unavailable'
/** The toast that says how Delete account went. */
const DELETED_TOAST = 'account-deleted'

/** Signing in from the Menu (ticket 0078; MenuPanel and SignIn cards): who is signed in on this device, the Sign in
 * Subpanel with its Google button, coming back from Google, and Sign out. A Guest's device asks the backend nothing
 * until Sign in is pressed; a signed-in one asks who it is as the app opens and as its tab comes back into view. */
export function useAccountFlow(deps: AccountFlowDeps) {
  /** The signed-in account, from what the device remembers until the backend answers; none is a Guest. */
  const account = ref<Account | undefined>(deps.account.remembered())
  /** Why the last try at signing in didn't sign the person in, said at the top of the Subpanel. */
  const refusal = ref<SignInRefusal>()
  /** Whether Cloudflare's widget is asking the person something, which is rare: a line above it says what it is. */
  const checkAsks = ref(false)
  /** Between the press on the Google button and the page leaving for Google. */
  const leaving = ref(false)

  /** The Settings kept in step (ticket 1086): a Guest's stay on the device, a signed-in person's follow the account. */
  const keptSettings = useKeptSettings({
    account: deps.account,
    device: deps.settings,
    signedIn: () => account.value !== undefined,
    onSignedOut: () => (account.value = undefined),
  })

  /** Asks the backend who is signed in, and takes the account's settings from the same answer. A session that ended
   * makes the device a Guest's quietly; with no answer (offline, the backend down) the remembered account stays as it
   * is. */
  async function check() {
    const takeSettings = keptSettings.asking()
    const answer = await deps.account.check()
    if (answer.state === 'signed-in') {
      account.value = answer.account
      takeSettings(answer.settings)
    } else if (answer.state === 'signed-out') account.value = undefined
    else keptSettings.sendWaiting()
  }

  /** Back from Google signed in: the Menu opens on the Account section, unfolded, to show who is signed in. */
  function showAccount() {
    deps.foldedSections.value = deps.foldedSections.value.filter((id) => id !== ACCOUNT_SECTION)
    deps.openMenu('account')
  }

  const back = deps.account.takeReturn()
  if (back === 'signed-in') void check().then(showAccount)
  else if (back) {
    refusal.value = back
    deps.openMenu('sign-in')
  } else if (account.value) void check()

  let verification: Verification | undefined
  /** The check's token, asked for as the Subpanel opens so a press finds it ready; undefined once it failed. */
  let token: Promise<string | undefined> | undefined
  let tokenAt = 0

  function askToken(from: Verification) {
    const asked: Promise<string | undefined> = from.token().then(
      (given) => {
        if (token === asked) tokenAt = Date.now()
        return given
      },
      () => undefined,
    )
    token = asked
  }

  onScopeDispose(
    deps.account.onBackInView(() => {
      if (account.value) void check()
      // Back from Google by the browser's Back: the button works again, with a token of its own.
      if (leaving.value && verification) {
        leaving.value = false
        askToken(verification)
      }
    }),
  )

  /** The toast for what can't be done now: no internet, or the backend's own wait as the time. `words` are the
   * sign-in's lines by default, Delete account's for a deletion. */
  function sayUnavailable(why: SignInUnavailable, words = { offline: deps.messages().account.offline, unavailable: deps.messages().account.unavailable }) {
    const t = deps.messages().account
    if (why.reason === 'offline') return deps.showToast(UNAVAILABLE_TOAST, words.offline, 'warning')
    const wait = waitOf(why.retryAfterSeconds)
    const time = fillBlanks(wait.unit === 'minutes' ? t.waitMinutes : t.waitSeconds, { count: wait.count })
    deps.showToast(UNAVAILABLE_TOAST, fillBlanks(words.unavailable, { time }), 'warning')
  }

  /** A press on the Menu's Sign in: whether the Subpanel may open. When the backend can't be reached the row stays as
   * it is and the press shows a toast (ticket 0381's rule). */
  async function mayOpenSignIn(): Promise<boolean> {
    const answer = await deps.account.canSignIn()
    if (!answer.ok) sayUnavailable(answer)
    return answer.ok
  }

  /** Cloudflare's check in the open Subpanel, started as it opens; returns what the Subpanel calls as it closes. */
  function verifySignIn(container: HTMLElement): () => void {
    const started = deps.account.verify(container, (asking) => (checkAsks.value = asking))
    verification = started
    askToken(started)
    return () => {
      started.dispose()
      if (verification !== started) return
      verification = undefined
      token = undefined
      checkAsks.value = false
      refusal.value = undefined
    }
  }

  /** Continue with Google: waits for the check's token, asks for Google's address with it, and the page leaves for it.
   * The button is busy from the press on. */
  async function onContinueWithGoogle() {
    const from = verification
    if (!from || leaving.value) return
    leaving.value = true
    let given = await token
    token = undefined
    if (given !== undefined && Date.now() - tokenAt >= TOKEN_FRESH_MS) given = undefined
    // No token, or one too old to be taken: the check is asked again, and a second failure is said.
    given ??= await from.token().catch(() => undefined)
    if (verification !== from) return void (leaving.value = false)
    const result = given === undefined ? ({ ok: false, reason: 'failed' } as const) : await deps.account.startSignIn(given)
    if (result.ok) return
    leaving.value = false
    if (result.reason === 'failed') refusal.value = 'failed'
    else sayUnavailable(result)
    // The token is spent either way: the next press finds a new one.
    if (verification === from) askToken(from)
  }

  /** Sign out, with no confirm: nothing on the device is lost. The device forgets the account at once, also when the
   * backend can't be reached. */
  async function onSignOut() {
    account.value = undefined
    await deps.account.signOut()
  }

  /** "Delete your account?" (ticket 0082; ConfirmDialogs card): asked before anything is deleted. */
  const deleting = (deps.dialogs ?? useDialogs()).flag('delete-account')
  /** Between the confirm and the backend's answer, so a second press asks the backend nothing. */
  const deletingNow = ref(false)

  function onRequestDeleteAccount() {
    if (account.value) deleting.value = true
  }

  function onCancelDeleteAccount() {
    deleting.value = false
  }

  /** Deletes the account. Once the backend says it is gone the device is a Guest's, with its Projects as they were;
   * when the backend can't be reached nothing changes and a toast says so. */
  async function onConfirmDeleteAccount() {
    if (deletingNow.value) return
    deletingNow.value = true
    const result = await deps.account.deleteAccount()
    deletingNow.value = false
    deleting.value = false
    const t = deps.messages().account
    if (result.ok) {
      account.value = undefined
      deps.showToast(DELETED_TOAST, t.deleted, 'success')
    } else if (result.reason === 'signed-out') {
      account.value = undefined
      deps.showToast(DELETED_TOAST, t.deleteSignedOut, 'info')
    } else sayUnavailable(result, { offline: t.deleteOffline, unavailable: t.deleteUnavailable })
  }

  return {
    account,
    signInRefusal: refusal,
    signInAsks: checkAsks,
    signInLeaving: leaving,
    mayOpenSignIn,
    verifySignIn,
    onContinueWithGoogle,
    onSignOut,
    onRequestDeleteAccount,
    onCancelDeleteAccount,
    onConfirmDeleteAccount,
  }
}

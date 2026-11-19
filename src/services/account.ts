import { parseAccount, parseSignInReturn, SIGN_IN_RETURN_PARAM, type Account, type SignInReturn } from '../domain/account'
import { changedSince, parseAccountSettings, parseSettingsChanges, type AccountSettings, type KeptSettingName, type KeptSettings, type KeptValue } from '../domain/keptSettings'
import { offline, retryAfterSeconds } from './backendAnswer'
import { verify, type Verification } from './turnstile'

// The openbeads account, as the app meets the backend (ticket 0078): who is signed in, starting a sign-in with Google,
// and Sign out. Not `appSignIn`, which is the host's own sign-in (Cloudflare Access, ticket 1041). Every call answers
// with a result and none throws; a Guest's device calls nothing until the person presses Sign in.

/** The key the signed-in account's email and plan are remembered under, so the Menu shows them with no answer. */
const REMEMBERED_KEY = 'openbeads:account'
/** The key the changed settings not yet sent are kept under, with the email of the account they wait for. */
const WAITING_KEY = 'openbeads:settings-waiting'
/** The action the Subpanel's Turnstile widget names; the Worker's `start` refuses a token solved for another. */
const TURNSTILE_ACTION = 'sign-in'
/** The wait when the backend gave none: it couldn't be reached, or answered something unexpected. */
const DEFAULT_RETRY_SECONDS = 60
/** Google's sign-in address, the only one a sign-in may leave the app for. */
const GOOGLE = 'https://accounts.google.com/'

/** What the backend says of this device's session: `no-answer` when it couldn't be asked (offline, down, limited).
 * `settings` are the account's Settings kept in step (ticket 1086); none while their switch is off. */
type AccountAnswer = { state: 'signed-in'; account: Account; settings?: AccountSettings } | { state: 'signed-out' } | { state: 'no-answer' }

/** How sending changed settings went: `kept` with what the account now holds, which may be another device's later
 * change; `no-answer` when they couldn't be sent, and wait. */
type SettingsAnswer = { state: 'kept'; settings: AccountSettings } | { state: 'signed-out' } | { state: 'no-answer' }

/** Why signing in can't be done now: no internet, or the backend can't be reached, limits or is switched off. */
export type SignInUnavailable = { ok: false; reason: 'offline' } | { ok: false; reason: 'unavailable'; retryAfterSeconds: number }
/** Whether a sign-in can be started. */
type SignInAvailability = { ok: true } | SignInUnavailable
/** How starting a sign-in went: on `ok` the page is leaving for Google; `failed` is a check that didn't pass. */
type SignInStart = SignInAvailability | { ok: false; reason: 'failed' }

/** What the account flow needs from outside the page; `memoryAccount` is its twin for tests and the demo. */
export interface AccountService {
  /** The account this device remembers being signed in to, with no request made. */
  remembered: () => Account | undefined
  /** Asks the backend who is signed in, and remembers or forgets by its answer. Only for a device that remembers an
   * account or has just come back from Google: a Guest's never asks. */
  check: () => Promise<AccountAnswer>
  /** Whether a sign-in can be started now, asked by a press on the Menu's Sign in. */
  canSignIn: () => Promise<SignInAvailability>
  /** Cloudflare's check, rendered in the open Subpanel; `onAsks` hears when it asks the person something. */
  verify: (container: HTMLElement, onAsks: (asking: boolean) => void) => Verification
  /** Asks the backend for Google's address with a Turnstile token and sends the page there. */
  startSignIn: (token: string) => Promise<SignInStart>
  /** Ends this device's session and forgets the account, also when the backend can't be reached. */
  signOut: () => Promise<void>
  /** How the sign-in the page came back from ended, read once; the mark is taken off the address. */
  takeReturn: () => SignInReturn | undefined
  /** Calls `listener` each time the tab comes back into view; returns the way to stop. */
  onBackInView: (listener: () => void) => () => void
  /** A setting kept in step was changed on this device: on a signed-in one it waits to be sent, with the time of the
   * change. A Guest's device keeps nothing. */
  settingChanged: <N extends KeptSettingName>(name: N, value: KeptValue<N>) => void
  /** The changed settings waiting to be sent for the remembered account; none for a Guest or another account's. */
  waitingSettings: () => KeptSettings
  /** Sends changed settings. Once kept, those of them still waiting unchanged wait no more. Nothing is asked with no
   * internet or before a `Retry-After` has passed. */
  sendSettings: (changes: KeptSettings) => Promise<SettingsAnswer>
  /** Calls `listener` each time the device is online again; returns the way to stop. */
  onOnline: (listener: () => void) => () => void
}

function remembered(): Account | undefined {
  try {
    return parseAccount(JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? 'null'))
  } catch {
    return undefined
  }
}

function remember(account: Account | undefined) {
  try {
    if (account) localStorage.setItem(REMEMBERED_KEY, JSON.stringify(account))
    else {
      localStorage.removeItem(REMEMBERED_KEY)
      // What waited to be sent goes with the account, so it never reaches another one signed in here (ticket 1086).
      localStorage.removeItem(WAITING_KEY)
    }
  } catch {
    // Storage blocked: the account is asked for again the next time the app opens signed in.
  }
}

function waitingSettings(): KeptSettings {
  try {
    const kept = JSON.parse(localStorage.getItem(WAITING_KEY) ?? 'null') as { email?: unknown; settings?: unknown } | null
    const account = remembered()
    if (!kept || !account || kept.email !== account.email) return {}
    return parseSettingsChanges({ settings: kept.settings }) ?? {}
  } catch {
    return {}
  }
}

function keepWaiting(waiting: KeptSettings) {
  const account = remembered()
  try {
    if (account && Object.keys(waiting).length) localStorage.setItem(WAITING_KEY, JSON.stringify({ email: account.email, settings: waiting }))
    else localStorage.removeItem(WAITING_KEY)
  } catch {
    // Storage blocked: the change stays on this device, and the account's value takes its place at the next open.
  }
}

function settingChanged<N extends KeptSettingName>(name: N, value: KeptValue<N>) {
  if (remembered()) keepWaiting({ ...waitingSettings(), [name]: { value, changedAt: Date.now() } })
}

/** The times before which the backend is not asked again, by what is asked: its own `Retry-After`. */
const askAgainAt = { account: 0, signIn: 0, settings: 0 }

/** The wait an answer asks for, when it is one that says "not now": `429`, or `503`. */
function notNowFor(response: Response): number | undefined {
  if (response.status !== 429 && response.status !== 503) return undefined
  return retryAfterSeconds(response) ?? DEFAULT_RETRY_SECONDS
}

/** Signing in is unavailable for `seconds` from now: nothing asks before that has passed. */
function unavailableFor(seconds: number): SignInUnavailable {
  askAgainAt.signIn = Date.now() + seconds * 1000
  return { ok: false, reason: 'unavailable', retryAfterSeconds: seconds }
}

/** What stands in the way of asking about a sign-in at all: no internet, or a wait that hasn't passed. */
function standsInTheWay(): SignInUnavailable | undefined {
  if (offline()) return { ok: false, reason: 'offline' }
  const left = Math.ceil((askAgainAt.signIn - Date.now()) / 1000)
  return left > 0 ? { ok: false, reason: 'unavailable', retryAfterSeconds: left } : undefined
}

/** A request that failed with no answer: offline when the browser says so, else the backend can't be reached. */
const noAnswer = (): SignInUnavailable => (offline() ? { ok: false, reason: 'offline' } : unavailableFor(DEFAULT_RETRY_SECONDS))

async function check(): Promise<AccountAnswer> {
  if (offline() || Date.now() < askAgainAt.account) return { state: 'no-answer' }
  try {
    const response = await fetch('/api/me', { headers: { Accept: 'application/json' } })
    if (response.status === 401) {
      remember(undefined)
      return { state: 'signed-out' }
    }
    const answer: unknown = response.ok ? await response.json() : undefined
    const account = parseAccount(answer)
    if (!account) {
      const wait = notNowFor(response)
      if (wait) askAgainAt.account = Date.now() + wait * 1000
      return { state: 'no-answer' }
    }
    remember(account)
    return { state: 'signed-in', account, settings: parseAccountSettings((answer as { settings?: unknown }).settings) }
  } catch {
    return { state: 'no-answer' }
  }
}

async function sendSettings(changes: KeptSettings): Promise<SettingsAnswer> {
  if (offline() || Date.now() < askAgainAt.settings) return { state: 'no-answer' }
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: changes }),
    })
    if (response.status === 401) {
      remember(undefined)
      return { state: 'signed-out' }
    }
    const settings = response.ok ? parseAccountSettings(((await response.json()) as { settings?: unknown } | null)?.settings) : undefined
    if (!settings) {
      const wait = notNowFor(response)
      if (wait) askAgainAt.settings = Date.now() + wait * 1000
      return { state: 'no-answer' }
    }
    // A setting changed again while this was on its way still waits.
    keepWaiting(changedSince(waitingSettings(), changes))
    return { state: 'kept', settings }
  } catch {
    return { state: 'no-answer' }
  }
}

async function canSignIn(): Promise<SignInAvailability> {
  const stopped = standsInTheWay()
  if (stopped) return stopped
  try {
    const response = await fetch('/api/auth/status', { headers: { Accept: 'application/json' } })
    // A host with no backend may answer any path with a page: only the Worker's own yes counts.
    const yes = response.ok && ((await response.json().catch(() => undefined)) as { signIn?: unknown } | undefined)?.signIn === true
    return yes ? { ok: true } : unavailableFor(notNowFor(response) ?? DEFAULT_RETRY_SECONDS)
  } catch {
    return noAnswer()
  }
}

async function startSignIn(token: string): Promise<SignInStart> {
  const stopped = standsInTheWay()
  if (stopped) return stopped
  try {
    const response = await fetch(`/api/auth/google/start?return=${encodeURIComponent(location.pathname)}`, {
      method: 'POST',
      headers: { 'X-Turnstile-Token': token },
    })
    if (!response.ok) {
      const wait = notNowFor(response)
      return wait ? unavailableFor(wait) : { ok: false, reason: 'failed' }
    }
    const { url } = (await response.json()) as { url?: unknown }
    if (typeof url !== 'string' || !url.startsWith(GOOGLE)) return { ok: false, reason: 'failed' }
    // A full-page redirect: the open Project is saved as it is (autosave), and the page comes back to it.
    location.assign(url)
    return { ok: true }
  } catch {
    return noAnswer()
  }
}

async function signOut(): Promise<void> {
  remember(undefined)
  try {
    await fetch('/api/auth/sign-out', { method: 'POST' })
  } catch {
    // The device is a Guest's either way; the session it left ends by itself after its 90 days.
  }
}

function takeReturn(): SignInReturn | undefined {
  const back = parseSignInReturn(location.search)
  if (back) {
    const url = new URL(location.href)
    url.searchParams.delete(SIGN_IN_RETURN_PARAM)
    try {
      history.replaceState(history.state, '', url.pathname + url.search + url.hash)
    } catch {
      // The mark stays: a reload opens the Menu the same way again, which is harmless.
    }
  }
  return back
}

/** The tab shown again, or the page brought back whole by the browser's Back (from Google's page, say). */
function onBackInView(listener: () => void): () => void {
  const onChange = () => {
    if (document.visibilityState === 'visible') listener()
  }
  const onShow = (event: PageTransitionEvent) => {
    if (event.persisted) listener()
  }
  document.addEventListener('visibilitychange', onChange)
  window.addEventListener('pageshow', onShow)
  return () => {
    document.removeEventListener('visibilitychange', onChange)
    window.removeEventListener('pageshow', onShow)
  }
}

function onOnline(listener: () => void): () => void {
  window.addEventListener('online', listener)
  return () => window.removeEventListener('online', listener)
}

export const browserAccount: AccountService = {
  remembered,
  check,
  canSignIn,
  verify: (container, onAsks) => verify(container, { action: TURNSTILE_ACTION, onAsks }),
  startSignIn,
  signOut,
  takeReturn,
  onBackInView,
  settingChanged,
  waitingSettings,
  sendSettings,
  onOnline,
}

import type { Account, AccountMark } from '../domain/account'
import { changedSince, KEPT_SETTING_NAMES, type AccountSettings, type KeptSettings } from '../domain/keptSettings'
import type { AccountService, SignInUnavailable } from './account'

/** What the twin's device and backend start as, and what a test changes later through `state`. */
export interface MemoryAccountState {
  /** The account the device remembers. */
  remembered?: Account
  /** The account the backend's session is for; none is a session that ended, or a Guest. */
  session?: Account
  /** Whether the backend answers: `up`, or why it doesn't. */
  backend: 'up' | SignInUnavailable
  /** What the address marks: how a sign-in ended, or the Homepage asking for Sign in; read once. */
  returned?: AccountMark
  /** The Turnstile token handed out; none is a check that fails. */
  token?: string
  /** The tokens sign-ins were started with: in a browser the page would have left for Google. */
  started: string[]
  /** The settings the session's account holds on the backend (ticket 1086); `off` is their switch switched off. */
  settings: AccountSettings | 'off'
  /** The changed settings waiting on the device to be sent. */
  waiting: KeptSettings
  /** Every send of changed settings the backend took, oldest first. */
  sent: KeptSettings[]
}

/** The account service's twin in memory (ticket 0078): a device and a backend with nothing behind them, for tests and
 * for the Homepage's demo, which is a Guest's and never signs in. `state` is the test's handle on both. */
export function memoryAccount(
  start: Partial<MemoryAccountState> = {},
): AccountService & { state: MemoryAccountState; comeBackInView: () => void; comeOnline: () => void } {
  const state: MemoryAccountState = { backend: 'up', token: 'memory-token', started: [], settings: {}, waiting: {}, sent: [], ...start }
  const listeners = new Set<() => void>()
  const onlineListeners = new Set<() => void>()
  /** The device forgets the account, and with it what waited to be sent. */
  const forget = () => {
    state.remembered = undefined
    state.waiting = {}
  }
  /** The backend's rule: a change is kept when it is later than the one held, and a time in the future counts as now. */
  const keepTheLater = (changes: KeptSettings): AccountSettings => {
    const held: AccountSettings = state.settings === 'off' ? {} : { ...state.settings }
    for (const name of KEPT_SETTING_NAMES) {
      const change = changes[name]
      const before = held[name]
      if (!change) continue
      const changedAt = Math.min(change.changedAt, Date.now())
      if (before === undefined || before === 'unknown' || changedAt > before.changedAt) Object.assign(held, { [name]: { ...change, changedAt } })
    }
    return held
  }
  return {
    state,
    comeBackInView: () => listeners.forEach((listener) => listener()),
    comeOnline: () => onlineListeners.forEach((listener) => listener()),
    remembered: () => state.remembered,
    check: async () => {
      if (state.backend !== 'up') return { state: 'no-answer' }
      if (!state.session) {
        forget()
        return { state: 'signed-out' }
      }
      state.remembered = state.session
      return { state: 'signed-in', account: state.session, settings: state.settings === 'off' ? undefined : { ...state.settings } }
    },
    canSignIn: async () => (state.backend === 'up' ? { ok: true } : state.backend),
    verify: () => ({
      token: () => (state.token === undefined ? Promise.reject(new Error('turnstile failed')) : Promise.resolve(state.token)),
      dispose: () => undefined,
    }),
    startSignIn: async (token) => {
      if (state.backend !== 'up') return state.backend
      state.started.push(token)
      return { ok: true }
    },
    signOut: async () => {
      forget()
      if (state.backend === 'up') state.session = undefined
    },
    takeReturn: () => {
      const back = state.returned
      state.returned = undefined
      return back
    },
    onBackInView: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    settingChanged: (name, value) => {
      if (state.remembered) state.waiting = { ...state.waiting, [name]: { value, changedAt: Date.now() } }
    },
    waitingSettings: () => ({ ...state.waiting }),
    sendSettings: async (changes) => {
      if (state.backend !== 'up' || state.settings === 'off') return { state: 'no-answer' }
      if (!state.session) {
        forget()
        return { state: 'signed-out' }
      }
      state.settings = keepTheLater(changes)
      state.sent.push(changes)
      state.waiting = changedSince(state.waiting, changes)
      return { state: 'kept', settings: { ...state.settings } }
    },
    onOnline: (listener) => {
      onlineListeners.add(listener)
      return () => void onlineListeners.delete(listener)
    },
  }
}

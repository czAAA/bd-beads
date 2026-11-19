import type { Account, SignInReturn } from '../domain/account'
import type { AccountService, SignInUnavailable } from './account'

/** What the twin's device and backend start as, and what a test changes later through `state`. */
export interface MemoryAccountState {
  /** The account the device remembers. */
  remembered?: Account
  /** The account the backend's session is for; none is a session that ended, or a Guest. */
  session?: Account
  /** Whether the backend answers: `up`, or why it doesn't. */
  backend: 'up' | SignInUnavailable
  /** How the sign-in the page came back from ended, read once. */
  returned?: SignInReturn
  /** The Turnstile token handed out; none is a check that fails. */
  token?: string
  /** The tokens sign-ins were started with: in a browser the page would have left for Google. */
  started: string[]
}

/** The account service's twin in memory (ticket 0078): a device and a backend with nothing behind them, for tests and
 * for the Homepage's demo, which is a Guest's and never signs in. `state` is the test's handle on both. */
export function memoryAccount(start: Partial<MemoryAccountState> = {}): AccountService & { state: MemoryAccountState; comeBackInView: () => void } {
  const state: MemoryAccountState = { backend: 'up', token: 'memory-token', started: [], ...start }
  const listeners = new Set<() => void>()
  return {
    state,
    comeBackInView: () => listeners.forEach((listener) => listener()),
    remembered: () => state.remembered,
    check: async () => {
      if (state.backend !== 'up') return { state: 'no-answer' }
      state.remembered = state.session
      return state.session ? { state: 'signed-in', account: state.session } : { state: 'signed-out' }
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
      state.remembered = undefined
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
  }
}

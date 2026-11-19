import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import { memoryAccount, type MemoryAccountState } from '../../services/memoryAccount'
import { memoryDeviceSettings } from '../../testUtils/deviceSettings'
import { useAccountFlow } from './useAccountFlow'

const ann = { email: 'ann@example.com', plan: 'free' } as const

/** The flow over a device and a backend in memory, with what it shows and opens written down. */
function setup(start: Partial<MemoryAccountState> = {}) {
  const account = memoryAccount(start)
  const check = vi.spyOn(account, 'check')
  const showToast = vi.fn()
  const openMenu = vi.fn()
  const foldedSections = ref<readonly string[]>(['menu:account', 'menu:help'])
  const scope = effectScope()
  const flow = scope.run(() => useAccountFlow({ account, messages: () => en, showToast, openMenu, foldedSections, settings: memoryDeviceSettings().controls }))!
  return { account, check, showToast, openMenu, foldedSections, flow, scope }
}

/** Lets the flow's awaited answers land. */
const settled = () => new Promise((resolve) => setTimeout(resolve))

afterEach(() => vi.useRealTimers())

describe('useAccountFlow: who is signed in', () => {
  it('asks the backend nothing on a Guest’s device, as the app opens or as its tab comes back', async () => {
    const { account, check, flow } = setup()
    account.comeBackInView()
    await settled()
    expect(flow.account.value).toBeUndefined()
    expect(check).not.toHaveBeenCalled()
  })

  it('shows the remembered account at once, and asks who is signed in as the app opens and as its tab comes back', async () => {
    const { account, check, flow } = setup({ remembered: ann, session: ann })
    expect(flow.account.value).toEqual(ann)
    await settled()
    expect(check).toHaveBeenCalledTimes(1)
    account.state.session = { email: 'ann.new@example.com', plan: 'free' }
    account.comeBackInView()
    await settled()
    expect(flow.account.value).toEqual({ email: 'ann.new@example.com', plan: 'free' })
  })

  it('keeps showing the remembered account with no answer from the backend', async () => {
    const { flow, showToast } = setup({ remembered: ann, session: ann, backend: { ok: false, reason: 'offline' } })
    await settled()
    expect(flow.account.value).toEqual(ann)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('is a Guest’s again once the session has ended, with no toast and no Menu', async () => {
    const { account, flow, showToast, openMenu } = setup({ remembered: ann })
    await settled()
    expect(flow.account.value).toBeUndefined()
    expect(account.remembered()).toBeUndefined()
    expect(showToast).not.toHaveBeenCalled()
    expect(openMenu).not.toHaveBeenCalled()
  })

  it('stops asking once its scope is gone', async () => {
    const { account, check, scope } = setup({ remembered: ann, session: ann })
    await settled()
    scope.stop()
    account.comeBackInView()
    expect(check).toHaveBeenCalledTimes(1)
  })
})

describe('useAccountFlow: back from Google', () => {
  it('signed in: learns who from the backend, then opens the Menu on its Account section, unfolded, with no toast', async () => {
    const { flow, openMenu, showToast, foldedSections } = setup({ returned: 'signed-in', session: ann })
    expect(openMenu).not.toHaveBeenCalled()
    await settled()
    expect(flow.account.value).toEqual(ann)
    expect(openMenu).toHaveBeenCalledWith('account')
    expect(foldedSections.value).toEqual(['menu:help'])
    expect(showToast).not.toHaveBeenCalled()
  })

  it.each(['cancelled', 'failed', 'paused'] as const)('refused (%s): opens the Menu on the Sign in Subpanel with the reason', (refusal) => {
    const { flow, openMenu, check } = setup({ returned: refusal })
    expect(flow.signInRefusal.value).toBe(refusal)
    expect(openMenu).toHaveBeenCalledWith('sign-in')
    expect(check).not.toHaveBeenCalled()
  })
})

describe('useAccountFlow: the Sign in row', () => {
  it('lets the Subpanel open when a sign-in can be started', async () => {
    const { flow, showToast } = setup()
    expect(await flow.mayOpenSignIn()).toBe(true)
    expect(showToast).not.toHaveBeenCalled()
  })

  it.each([
    [900, 'Signing in is temporarily unavailable. Try again in 15 min.'],
    [60, 'Signing in is temporarily unavailable. Try again in 60 s.'],
  ])('opens nothing and says "temporarily unavailable" with the backend’s wait of %i s', async (retryAfterSeconds, text) => {
    const { flow, showToast } = setup({ backend: { ok: false, reason: 'unavailable', retryAfterSeconds } })
    expect(await flow.mayOpenSignIn()).toBe(false)
    expect(showToast).toHaveBeenCalledWith('account-unavailable', text, 'warning')
  })

  it('says so with no internet, in the same toast', async () => {
    const { flow, showToast } = setup({ backend: { ok: false, reason: 'offline' } })
    expect(await flow.mayOpenSignIn()).toBe(false)
    expect(showToast).toHaveBeenCalledWith('account-unavailable', en.account.offline, 'warning')
  })
})

describe('useAccountFlow: Continue with Google', () => {
  const container = {} as HTMLElement

  it('starts the sign-in with the check’s token, and stays busy while the page leaves', async () => {
    const { account, flow } = setup()
    flow.verifySignIn(container)
    await flow.onContinueWithGoogle()
    expect(account.state.started).toEqual(['memory-token'])
    expect(flow.signInLeaving.value).toBe(true)
    // A second press while it leaves starts nothing more.
    await flow.onContinueWithGoogle()
    expect(account.state.started).toHaveLength(1)
  })

  it('waits for Cloudflare’s check: busy from the press, and started only once the token is given', async () => {
    const { account, flow } = setup()
    let give!: (token: string) => void
    account.verify = () => ({ token: () => new Promise<string>((resolve) => (give = resolve)), dispose: () => undefined })
    flow.verifySignIn(container)
    const pressed = flow.onContinueWithGoogle()
    await settled()
    expect(flow.signInLeaving.value).toBe(true)
    expect(account.state.started).toEqual([])
    give('late-token')
    await pressed
    expect(account.state.started).toEqual(['late-token'])
  })

  it('asks for a new token when the one it holds is too old to be taken', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { account, flow } = setup()
    const tokens = ['first', 'second']
    account.verify = () => ({ token: async () => tokens.shift()!, dispose: () => undefined })
    flow.verifySignIn(container)
    await Promise.resolve()
    vi.setSystemTime(Date.now() + 5 * 60_000)
    await flow.onContinueWithGoogle()
    expect(account.state.started).toEqual(['second'])
  })

  it('says signing in did not work when the check fails, and lets the button be pressed again', async () => {
    const { account, flow, showToast } = setup({ token: undefined })
    flow.verifySignIn(container)
    await flow.onContinueWithGoogle()
    expect(flow.signInRefusal.value).toBe('failed')
    expect(flow.signInLeaving.value).toBe(false)
    expect(account.state.started).toEqual([])
    expect(showToast).not.toHaveBeenCalled()
    account.state.token = 'second-try'
    await flow.onContinueWithGoogle()
    expect(account.state.started).toEqual(['second-try'])
  })

  it('shows the toast when the backend can’t be reached, answers 429 or 503, or sign-in is switched off', async () => {
    const { account, flow, showToast } = setup()
    flow.verifySignIn(container)
    account.state.backend = { ok: false, reason: 'unavailable', retryAfterSeconds: 900 }
    await flow.onContinueWithGoogle()
    expect(showToast).toHaveBeenCalledWith('account-unavailable', 'Signing in is temporarily unavailable. Try again in 15 min.', 'warning')
    expect(flow.signInLeaving.value).toBe(false)
    expect(flow.signInRefusal.value).toBeUndefined()
  })

  it('forgets the refusal and the check once the Subpanel closes', async () => {
    const { account, flow } = setup({ returned: 'paused' })
    const close = flow.verifySignIn(container)
    close()
    expect(flow.signInRefusal.value).toBeUndefined()
    await flow.onContinueWithGoogle()
    expect(account.state.started).toEqual([])
  })

  it('works again when the page is brought back from Google by the browser’s Back', async () => {
    const { account, flow } = setup()
    flow.verifySignIn(container)
    await flow.onContinueWithGoogle()
    account.comeBackInView()
    expect(flow.signInLeaving.value).toBe(false)
    await flow.onContinueWithGoogle()
    expect(account.state.started).toHaveLength(2)
  })
})

describe('useAccountFlow: Sign out', () => {
  it('ends the session and is a Guest’s device at once', async () => {
    const { account, flow } = setup({ remembered: ann, session: ann })
    await settled()
    await flow.onSignOut()
    expect(flow.account.value).toBeUndefined()
    expect(account.state.session).toBeUndefined()
  })

  it('forgets the account also when the backend can’t be reached', async () => {
    const { account, flow } = setup({ remembered: ann, session: ann, backend: { ok: false, reason: 'unavailable', retryAfterSeconds: 60 } })
    await flow.onSignOut()
    expect(flow.account.value).toBeUndefined()
    expect(account.remembered()).toBeUndefined()
  })
})

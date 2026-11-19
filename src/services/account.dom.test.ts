import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountService } from './account'

// The account service against a backend that is a stubbed `fetch` (ticket 0078). Its waits are module state, so each
// test loads the module afresh.

const answer = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

async function load(): Promise<AccountService> {
  vi.resetModules()
  return (await import('./account')).browserAccount
}

/** Stubs `fetch` with `reply`, and gives the calls made. */
function backend(reply: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => reply(url, init))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const remember = (account: unknown) => localStorage.setItem('openbeads:account', JSON.stringify(account))
const ann = { email: 'ann@example.com', plan: 'free' }

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/app/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('browserAccount: who is signed in', () => {
  it('remembers nothing on a Guest’s device, and reads the account a signed-in one remembers with no request', async () => {
    const fetch = backend(() => answer(200, ann))
    const account = await load()
    expect(account.remembered()).toBeUndefined()
    remember(ann)
    expect(account.remembered()).toEqual(ann)
    localStorage.setItem('openbeads:account', 'not json')
    expect(account.remembered()).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('asks /api/me, and remembers the account it answers', async () => {
    const fetch = backend(() => answer(200, { email: 'ann.new@example.com', plan: 'free' }))
    const account = await load()
    remember(ann)
    expect(await account.check()).toEqual({ state: 'signed-in', account: { email: 'ann.new@example.com', plan: 'free' } })
    expect(fetch.mock.calls[0]![0]).toBe('/api/me')
    expect(account.remembered()).toEqual({ email: 'ann.new@example.com', plan: 'free' })
  })

  it('forgets the account on 401: the session ended', async () => {
    backend(() => answer(401, { error: 'signed-out' }))
    const account = await load()
    remember(ann)
    expect(await account.check()).toEqual({ state: 'signed-out' })
    expect(account.remembered()).toBeUndefined()
  })

  it('keeps the remembered account with no answer: offline, unreachable, or an answer that is no account', async () => {
    const account = await load()
    remember(ann)
    backend(() => {
      throw new TypeError('Failed to fetch')
    })
    expect(await account.check()).toEqual({ state: 'no-answer' })
    backend(() => answer(500, 'oops'))
    expect(await account.check()).toEqual({ state: 'no-answer' })
    const fetch = backend(() => answer(200, ann))
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await account.check()).toEqual({ state: 'no-answer' })
    expect(fetch).not.toHaveBeenCalled()
    expect(account.remembered()).toEqual(ann)
  })

  it('does not ask again before the Retry-After of a 429 or 503 has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const account = await load()
    remember(ann)
    const fetch = backend(() => answer(503, { error: 'feature-off', feature: 'api' }, { 'Retry-After': '900' }))
    expect(await account.check()).toEqual({ state: 'no-answer' })
    expect(await account.check()).toEqual({ state: 'no-answer' })
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 901_000)
    await account.check()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('browserAccount: signing in', () => {
  it('says a sign-in can be started when /api/auth/status answers', async () => {
    const fetch = backend(() => answer(200, { signIn: true }))
    const account = await load()
    expect(await account.canSignIn()).toEqual({ ok: true })
    expect(fetch.mock.calls[0]![0]).toBe('/api/auth/status')
  })

  it('reads a host with no backend, which answers any path with a page, as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><title>app</title>', { status: 200, headers: { 'Content-Type': 'text/html' } })))
    const account = await load()
    expect(await account.canSignIn()).toEqual({ ok: false, reason: 'unavailable', retryAfterSeconds: 60 })
  })

  it('reads 429 and 503 as unavailable for their Retry-After, and asks nothing before it has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const account = await load()
    const fetch = backend(() => answer(503, { error: 'feature-off', feature: 'sign-in' }, { 'Retry-After': '900' }))
    expect(await account.canSignIn()).toEqual({ ok: false, reason: 'unavailable', retryAfterSeconds: 900 })
    vi.setSystemTime(Date.now() + 300_000)
    expect(await account.canSignIn()).toEqual({ ok: false, reason: 'unavailable', retryAfterSeconds: 600 })
    expect(await account.startSignIn('token')).toEqual({ ok: false, reason: 'unavailable', retryAfterSeconds: 600 })
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 601_000)
    backend(() => answer(429, { error: 'rate-limited' }, { 'Retry-After': '60' }))
    expect(await account.canSignIn()).toEqual({ ok: false, reason: 'unavailable', retryAfterSeconds: 60 })
  })

  it('reads a backend that can’t be reached as unavailable for a minute, and no internet as offline with no wait', async () => {
    const account = await load()
    backend(() => {
      throw new TypeError('Failed to fetch')
    })
    expect(await account.canSignIn()).toEqual({ ok: false, reason: 'unavailable', retryAfterSeconds: 60 })
    const again = await load()
    const fetch = backend(() => answer(200, { signIn: true }))
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await again.canSignIn()).toEqual({ ok: false, reason: 'offline' })
    expect(await again.startSignIn('token')).toEqual({ ok: false, reason: 'offline' })
    expect(fetch).not.toHaveBeenCalled()
    online.mockReturnValue(true)
    expect(await again.canSignIn()).toEqual({ ok: true })
  })

  it('starts a sign-in with the Turnstile token and the page’s own path, and sends the page to Google’s address', async () => {
    history.replaceState(null, '', '/ru/app/?project=p1')
    const google = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=y'
    const fetch = backend(() => answer(200, { url: google }))
    const assign = vi.fn()
    vi.stubGlobal('location', { ...location, pathname: location.pathname, assign })
    const account = await load()
    expect(await account.startSignIn('token-1')).toEqual({ ok: true })
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('/api/auth/google/start?return=%2Fru%2Fapp%2F')
    expect(init).toMatchObject({ method: 'POST', headers: { 'X-Turnstile-Token': 'token-1' } })
    expect(assign).toHaveBeenCalledWith(google)
  })

  it('goes nowhere for a refusal or an address that is not Google’s: the start failed', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...location, pathname: '/app/', assign })
    const account = await load()
    backend(() => answer(403, { error: 'turnstile-failed' }))
    expect(await account.startSignIn('token')).toEqual({ ok: false, reason: 'failed' })
    backend(() => answer(200, { url: 'https://evil.example/' }))
    expect(await account.startSignIn('token')).toEqual({ ok: false, reason: 'failed' })
    expect(assign).not.toHaveBeenCalled()
  })

  it('reads how the sign-in ended from the address once, and takes the mark off it', async () => {
    history.replaceState(null, '', '/app/?account=paused#top')
    const account = await load()
    expect(account.takeReturn()).toBe('paused')
    expect(`${location.pathname}${location.search}${location.hash}`).toBe('/app/#top')
    expect(account.takeReturn()).toBeUndefined()
  })
})

describe('browserAccount: Sign out', () => {
  it('ends the session on the backend and forgets the account', async () => {
    const fetch = backend(() => answer(200, { signedOut: true }))
    const account = await load()
    remember(ann)
    await account.signOut()
    expect(fetch.mock.calls[0]).toEqual(['/api/auth/sign-out', { method: 'POST' }])
    expect(account.remembered()).toBeUndefined()
  })

  it('forgets the account also when the backend can’t be reached', async () => {
    backend(() => {
      throw new TypeError('Failed to fetch')
    })
    const account = await load()
    remember(ann)
    await expect(account.signOut()).resolves.toBeUndefined()
    expect(account.remembered()).toBeUndefined()
  })
})

describe('browserAccount: the tab back in view', () => {
  it('tells its listener when the tab becomes visible again, until stopped', async () => {
    const account = await load()
    const listener = vi.fn()
    const stop = account.onBackInView(listener)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

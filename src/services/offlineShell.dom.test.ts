import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = () => void

/** The slice of a service worker registration the module reads, with a way to play out an install. */
class FakeRegistration {
  waiting: object | null = null
  installing: (EventTarget & { state: string }) | null = null
  update = vi.fn(() => Promise.resolve())
  private found: Listener[] = []
  addEventListener(type: string, listener: Listener) {
    if (type === 'updatefound') this.found.push(listener)
  }
  /** A new worker starts installing, then finishes: `state` becomes installed. */
  install() {
    const worker = Object.assign(new EventTarget(), { state: 'installing' })
    this.installing = worker
    this.found.forEach((listener) => listener())
    worker.state = 'installed'
    worker.dispatchEvent(new Event('statechange'))
  }
}

function stubBrowser(options: { controlled: boolean; registration?: FakeRegistration; online?: boolean }) {
  const registration = options.registration ?? new FakeRegistration()
  const persist = vi.fn(() => Promise.resolve(true))
  const register = vi.fn(() => Promise.resolve(registration))
  vi.stubGlobal('navigator', {
    serviceWorker: { register, controller: options.controlled ? {} : null, addEventListener: vi.fn() },
    storage: { persist },
    onLine: options.online ?? true,
  })
  return { registration, persist, register }
}

async function freshModule() {
  vi.resetModules()
  return import('./offlineShell')
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('startOfflineShell', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true)
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('registers the worker under the app\'s base and never asks the browser for persistent storage (ticket 399)', async () => {
    const { register, persist } = stubBrowser({ controlled: false })
    const { startOfflineShell } = await freshModule()
    startOfflineShell('/bd-beads/')
    expect(register).toHaveBeenCalledWith('/bd-beads/sw.js', { scope: '/bd-beads/', updateViaCache: 'none' })
    expect(persist).not.toHaveBeenCalled()
  })

  it('does not throw in a browser without service workers', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    vi.stubGlobal('navigator', { storage: { persist } })
    const { startOfflineShell } = await freshModule()
    expect(() => startOfflineShell('/bd-beads/')).not.toThrow()
    expect(persist).not.toHaveBeenCalled()
  })

  it('does nothing outside a production build', async () => {
    vi.stubEnv('PROD', false)
    const { register } = stubBrowser({ controlled: false })
    const { startOfflineShell } = await freshModule()
    startOfflineShell('/bd-beads/')
    expect(register).not.toHaveBeenCalled()
  })

  it('does not call the very first install an update', async () => {
    const { registration } = stubBrowser({ controlled: false })
    const { startOfflineShell, browserAppUpdates } = await freshModule()
    const ready = vi.fn()
    browserAppUpdates.onReady(ready)
    startOfflineShell('/bd-beads/')
    await settle()
    registration.install()
    expect(ready).not.toHaveBeenCalled()
  })

  it('calls a worker that installs under a controlled page an update', async () => {
    const { registration } = stubBrowser({ controlled: true })
    const { startOfflineShell, browserAppUpdates } = await freshModule()
    const ready = vi.fn()
    browserAppUpdates.onReady(ready)
    startOfflineShell('/bd-beads/')
    await settle()
    registration.install()
    expect(ready).toHaveBeenCalledOnce()
  })

  it('knows of an update that was already waiting when the page loaded', async () => {
    const registration = new FakeRegistration()
    registration.waiting = {}
    stubBrowser({ controlled: true, registration })
    const { startOfflineShell, browserAppUpdates } = await freshModule()
    startOfflineShell('/bd-beads/')
    await settle()
    const ready = vi.fn()
    browserAppUpdates.onReady(ready)
    expect(ready).toHaveBeenCalledOnce()
  })

  it('hands the waiting worker the go-ahead when the update is applied', async () => {
    const registration = new FakeRegistration()
    const postMessage = vi.fn()
    registration.waiting = { postMessage }
    stubBrowser({ controlled: true, registration })
    const { startOfflineShell, browserAppUpdates } = await freshModule()
    startOfflineShell('/bd-beads/')
    await settle()
    browserAppUpdates.apply()
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  describe('an Access sign-in that has run out (ticket 1041)', () => {
    const redirect = { type: 'opaqueredirect' } as Response
    const plain = { type: 'basic' } as Response

    /** The host's answers to the worker file: asked without following a redirect, then asked to stay on this origin. */
    function stubHost(unfollowed: Response | Error, sameOrigin: Response | Error = plain) {
      // By the question, not by turn: the modules of earlier tests still listen on this document.
      const fetchStub = vi.fn((_url: string, init: RequestInit) => {
        const answer = init.redirect === 'manual' ? unfollowed : sameOrigin
        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
      })
      vi.stubGlobal('fetch', fetchStub)
      return fetchStub
    }

    async function startAndListen() {
      const { startOfflineShell, browserAppSignIn } = await freshModule()
      const runOut = vi.fn()
      browserAppSignIn.onRunOut(runOut)
      startOfflineShell('/bd-beads/')
      await settle()
      return { runOut, browserAppSignIn }
    }

    it('is noticed when the host sends the app\'s own request to another origin', async () => {
      stubBrowser({ controlled: true })
      const fetchStub = stubHost(redirect, new TypeError('refused'))
      const { runOut } = await startAndListen()
      expect(runOut).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenNthCalledWith(1, '/bd-beads/sw.js', { method: 'HEAD', cache: 'no-store', redirect: 'manual' })
      expect(fetchStub).toHaveBeenNthCalledWith(2, '/bd-beads/sw.js', { method: 'HEAD', cache: 'no-store', mode: 'same-origin' })
    })

    it('is told at once to a listener that comes after it was noticed', async () => {
      stubBrowser({ controlled: true })
      stubHost(redirect, new TypeError('refused'))
      const { browserAppSignIn } = await startAndListen()
      const late = vi.fn()
      browserAppSignIn.onRunOut(late)
      expect(late).toHaveBeenCalledOnce()
    })

    it('is not seen in a host that answers plainly', async () => {
      stubBrowser({ controlled: true })
      const fetchStub = stubHost(plain)
      const { runOut } = await startAndListen()
      expect(fetchStub).toHaveBeenCalledOnce()
      expect(runOut).not.toHaveBeenCalled()
    })

    it('is not seen in a redirect that stays on the host', async () => {
      stubBrowser({ controlled: true })
      stubHost(redirect, plain)
      const { runOut } = await startAndListen()
      expect(runOut).not.toHaveBeenCalled()
    })

    it('is not looked for offline', async () => {
      stubBrowser({ controlled: true, online: false })
      const fetchStub = stubHost(redirect, new TypeError('refused'))
      const { runOut } = await startAndListen()
      expect(fetchStub).not.toHaveBeenCalled()
      expect(runOut).not.toHaveBeenCalled()
    })

    it('is not seen in a request that fails', async () => {
      stubBrowser({ controlled: true })
      stubHost(new TypeError('no network'))
      const { runOut } = await startAndListen()
      expect(runOut).not.toHaveBeenCalled()
    })

    it('is looked for again when the tab is brought back', async () => {
      stubBrowser({ controlled: true })
      stubHost(plain)
      const { runOut } = await startAndListen()
      stubHost(redirect, new TypeError('refused'))
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      await settle()
      expect(runOut).toHaveBeenCalledOnce()
    })

    it('signs in by loading this page with the mark the worker lets through to the host', async () => {
      stubBrowser({ controlled: true })
      stubHost(plain)
      const assign = vi.fn()
      vi.stubGlobal('location', { href: 'https://openbeads.test/bd-beads/?project=7', assign })
      const { browserAppSignIn } = await startAndListen()
      browserAppSignIn.signIn()
      expect(assign).toHaveBeenCalledWith('https://openbeads.test/bd-beads/?project=7&sign-in=')
    })

    it('takes the mark off the address once the page is back from signing in', async () => {
      stubBrowser({ controlled: true })
      stubHost(plain)
      vi.stubGlobal('location', { href: 'https://openbeads.test/bd-beads/?project=7&sign-in=' })
      const replaceState = vi.spyOn(history, 'replaceState').mockImplementation(() => {})
      await startAndListen()
      expect(replaceState).toHaveBeenCalledWith(history.state, '', 'https://openbeads.test/bd-beads/?project=7')
    })
  })
})

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

function stubBrowser(options: { controlled: boolean; registration?: FakeRegistration }) {
  const registration = options.registration ?? new FakeRegistration()
  const persist = vi.fn(() => Promise.resolve(true))
  const register = vi.fn(() => Promise.resolve(registration))
  vi.stubGlobal('navigator', {
    serviceWorker: { register, controller: options.controlled ? {} : null, addEventListener: vi.fn() },
    storage: { persist },
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
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('registers the worker under the app\'s base and asks the browser to keep the library', async () => {
    const { register, persist } = stubBrowser({ controlled: false })
    const { startOfflineShell } = await freshModule()
    startOfflineShell('/bd-beads/')
    expect(register).toHaveBeenCalledWith('/bd-beads/sw.js', { scope: '/bd-beads/', updateViaCache: 'none' })
    expect(persist).toHaveBeenCalledOnce()
  })

  it('does nothing in a browser without service workers', async () => {
    vi.stubGlobal('navigator', {})
    const { startOfflineShell } = await freshModule()
    expect(() => startOfflineShell('/bd-beads/')).not.toThrow()
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
})

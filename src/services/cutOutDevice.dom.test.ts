import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserCutOutDevice } from './cutOutDevice'

// The device record in this browser's localStorage (ticket 0768): kept across pages, unreadable data read as nothing
// known, and a page the maker leaves not taken for one the browser closed mid-run.

const KEY = 'openbeads:cut-out-record'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('the device record (ticket 0768)', () => {
  it('keeps what it is given, for the next page to read', () => {
    browserCutOutDevice.write({ running: false, stopped: true, firstRunMs: 7_400 })
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ running: false, stopped: true, firstRunMs: 7_400 })
    expect(browserCutOutDevice.read()).toEqual({ running: false, stopped: true, firstRunMs: 7_400 })
  })

  it('reads nothing known from no record or an unreadable one', () => {
    expect(browserCutOutDevice.read()).toEqual({ running: false, stopped: false })
    localStorage.setItem(KEY, '{not json')
    expect(browserCutOutDevice.read()).toEqual({ running: false, stopped: false })
    localStorage.setItem(KEY, '{"running":"yes","firstRunMs":-3}')
    expect(browserCutOutDevice.read()).toEqual({ running: false, stopped: false })
  })

  it('clears the flag when the maker leaves the page for good, not when it is kept to come back to', () => {
    browserCutOutDevice.write({ running: true, stopped: false })
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    expect(browserCutOutDevice.read().running).toBe(true)
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }))
    expect(browserCutOutDevice.read().running).toBe(false)
  })
})

describe('the checks before a first download (ticket 0768)', () => {
  it('reports the memory a browser gives, and none where it gives none', () => {
    vi.stubGlobal('navigator', { ...navigator, deviceMemory: 2 })
    expect(browserCutOutDevice.memoryGb()).toBe(2)
    vi.stubGlobal('navigator', { ...navigator, deviceMemory: undefined })
    expect(browserCutOutDevice.memoryGb()).toBeUndefined()
  })

  it('reports the free space the storage estimate leaves, and none where it can’t say', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 100_000_000, usage: 30_000_000 }) } })
    expect(await browserCutOutDevice.freeBytes()).toBe(70_000_000)
    vi.stubGlobal('navigator', { storage: { estimate: () => Promise.reject(new Error('no')) } })
    expect(await browserCutOutDevice.freeBytes()).toBeUndefined()
    vi.stubGlobal('navigator', {})
    expect(await browserCutOutDevice.freeBytes()).toBeUndefined()
  })
})

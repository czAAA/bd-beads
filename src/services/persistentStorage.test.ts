import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserPersistentStorage } from './persistentStorage'

describe('browserPersistentStorage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads and asks through the browser', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    vi.stubGlobal('navigator', { storage: { persisted: () => Promise.resolve(false), persist } })
    expect(await browserPersistentStorage.persisted()).toBe(false)
    expect(await browserPersistentStorage.persist()).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
    persist.mockResolvedValueOnce(false)
    expect(await browserPersistentStorage.persist()).toBe(false)
  })

  it('answers unknown without the API, a refusal when it fails, and throws nothing', async () => {
    vi.stubGlobal('navigator', {})
    expect(await browserPersistentStorage.persisted()).toBeUndefined()
    await expect(browserPersistentStorage.persist()).resolves.toBeUndefined()
    vi.stubGlobal('navigator', {
      storage: { persisted: () => Promise.reject(new Error('no')), persist: () => Promise.reject(new Error('no')) },
    })
    expect(await browserPersistentStorage.persisted()).toBeUndefined()
    await expect(browserPersistentStorage.persist()).resolves.toBe(false)
  })
})

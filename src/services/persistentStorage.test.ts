import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserPersistentStorage } from './persistentStorage'

describe('browserPersistentStorage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads and asks through the browser', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    vi.stubGlobal('navigator', { storage: { persisted: () => Promise.resolve(false), persist } })
    expect(await browserPersistentStorage.persisted()).toBe(false)
    await browserPersistentStorage.persist()
    expect(persist).toHaveBeenCalledOnce()
  })

  it('answers unknown and throws nothing without the API or when it refuses', async () => {
    vi.stubGlobal('navigator', {})
    expect(await browserPersistentStorage.persisted()).toBeUndefined()
    await expect(browserPersistentStorage.persist()).resolves.toBeUndefined()
    vi.stubGlobal('navigator', {
      storage: { persisted: () => Promise.reject(new Error('no')), persist: () => Promise.reject(new Error('no')) },
    })
    expect(await browserPersistentStorage.persisted()).toBeUndefined()
    await expect(browserPersistentStorage.persist()).resolves.toBeUndefined()
  })
})

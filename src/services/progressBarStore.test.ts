import { beforeEach, describe, expect, it } from 'vitest'
import { createProgressBarStore, PROGRESS_BAR_STORAGE_KEY } from './progressBarStore'

const memory = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) }
}

describe('progressBarStore', () => {
  let storage: ReturnType<typeof memory>
  beforeEach(() => {
    storage = memory()
  })

  it('has the bar shown until the person turns them off', () => {
    expect(createProgressBarStore(storage).load()).toBe(true)
  })

  it('remembers off and on', () => {
    const store = createProgressBarStore(storage)
    store.save(false)
    expect(createProgressBarStore(storage).load()).toBe(false)
    expect(storage.getItem(PROGRESS_BAR_STORAGE_KEY)).toBe('off')
    store.save(true)
    expect(createProgressBarStore(storage).load()).toBe(true)
  })

  it('carries on with the bar shown, and does not throw, where storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(createProgressBarStore(blocked).load()).toBe(true)
    expect(() => createProgressBarStore(blocked).save(false)).not.toThrow()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { createRulersStore, RULERS_STORAGE_KEY } from './rulersStore'

const memory = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) }
}

describe('rulersStore', () => {
  let storage: ReturnType<typeof memory>
  beforeEach(() => {
    storage = memory()
  })

  it('has rulers on until the person turns them off', () => {
    expect(createRulersStore(storage).load()).toBe(true)
  })

  it('remembers off and on', () => {
    const store = createRulersStore(storage)
    store.save(false)
    expect(createRulersStore(storage).load()).toBe(false)
    expect(storage.getItem(RULERS_STORAGE_KEY)).toBe('off')
    store.save(true)
    expect(createRulersStore(storage).load()).toBe(true)
  })

  it('carries on with rulers on, and does not throw, where storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(createRulersStore(blocked).load()).toBe(true)
    expect(() => createRulersStore(blocked).save(false)).not.toThrow()
  })
})

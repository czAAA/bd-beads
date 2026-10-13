import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_MAKER_NAME } from '../domain/makerName'
import { MAKER_NAME_KEY, browserMakerNameStore, createMakerNameStore } from './makerNameStore'

beforeEach(() => localStorage.clear())

describe("the maker's name store (ticket 161)", () => {
  const store = browserMakerNameStore

  it('is empty until one is set', () => {
    expect(store.load()).toBe('')
  })

  it('is kept on this device, trimmed, and survives a reload', () => {
    store.save('  Maria Kovaleva ')

    expect(localStorage.getItem(MAKER_NAME_KEY)).toBe('Maria Kovaleva')
    expect(store.load()).toBe('Maria Kovaleva')
  })

  it('can be changed, and an empty one clears it', () => {
    store.save('Maria')
    store.save('Anna')
    expect(store.load()).toBe('Anna')

    store.save('   ')
    expect(localStorage.getItem(MAKER_NAME_KEY)).toBeNull()
    expect(store.load()).toBe('')
  })

  it('holds at most 40 characters', () => {
    expect(store.save('x'.repeat(60))).toBe('x'.repeat(MAX_MAKER_NAME))
    expect(store.load()).toHaveLength(40)
  })

  it('reads as empty and still hands back the name when storage is blocked', () => {
    const blocked = createMakerNameStore({
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    expect(blocked.load()).toBe('')
    expect(blocked.save('Maria')).toBe('Maria')
  })
})

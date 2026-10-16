import { describe, expect, it } from 'vitest'
import { readKey, removeKey } from './storageKeys'

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

describe('the move from bd-beads:* to openbeads:* keys (ticket 392)', () => {
  it('copies the old value forward when the new key is absent, and leaves the old key alone', () => {
    const storage = memory({ 'bd-beads:theme': 'dark' })
    expect(readKey(storage, 'openbeads:theme')).toBe('dark')
    expect(storage.data.get('openbeads:theme')).toBe('dark')
    expect(storage.data.get('bd-beads:theme')).toBe('dark')
  })

  it('prefers the new key', () => {
    const storage = memory({ 'bd-beads:theme': 'dark', 'openbeads:theme': 'light' })
    expect(readKey(storage, 'openbeads:theme')).toBe('light')
  })

  it('reads nothing when neither key exists', () => {
    expect(readKey(memory(), 'openbeads:theme')).toBeNull()
  })

  it('does not bring a cleared value back from the old key', () => {
    const storage = memory({ 'bd-beads:maker-name': 'Anna' })
    expect(readKey(storage, 'openbeads:maker-name')).toBe('Anna')
    removeKey(storage, 'openbeads:maker-name')
    expect(readKey(storage, 'openbeads:maker-name')).toBeNull()
    expect(storage.data.get('bd-beads:maker-name')).toBe('Anna')
  })

  it('does not bring an old value back after it was cleared before ever being read', () => {
    const storage = memory({ 'bd-beads:maker-name': 'Anna' })
    removeKey(storage, 'openbeads:maker-name')
    expect(readKey(storage, 'openbeads:maker-name')).toBeNull()
  })
})

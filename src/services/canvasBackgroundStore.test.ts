import { describe, expect, it } from 'vitest'
import { CANVAS_BACKGROUND_STORAGE_KEY, createCanvasBackgroundStore } from './canvasBackgroundStore'

function memory(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[CANVAS_BACKGROUND_STORAGE_KEY, initial]])
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
}

describe('canvasBackgroundStore', () => {
  it('starts at the first background', () => {
    expect(createCanvasBackgroundStore(memory()).load()).toBe(1)
  })

  it('remembers the number, including a 6 that light cannot show', () => {
    const storage = memory()
    const store = createCanvasBackgroundStore(storage)
    store.save(6)
    expect(createCanvasBackgroundStore(storage).load()).toBe(6)
  })

  it.each(['0', '7', 'x', '2.5', ''])('ignores a stored %j', (raw) => {
    expect(createCanvasBackgroundStore(memory(raw)).load()).toBe(1)
  })

  it('falls back when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    const store = createCanvasBackgroundStore(blocked)
    expect(store.load()).toBe(1)
    expect(() => store.save(3)).not.toThrow()
  })
})

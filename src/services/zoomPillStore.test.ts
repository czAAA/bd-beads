import { describe, expect, it } from 'vitest'
import { createZoomPillStore, ZOOM_PILL_STORAGE_KEY } from './zoomPillStore'

const memory = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) }
}

describe('zoomPillStore', () => {
  it('starts in the bottom-right corner', () => {
    expect(createZoomPillStore(memory()).load()).toBe('bottom-right')
  })

  it('remembers the corner', () => {
    const storage = memory()
    createZoomPillStore(storage).save('top-left')
    expect(createZoomPillStore(storage).load()).toBe('top-left')
  })

  it('ignores a value that is not a corner', () => {
    const storage = memory()
    storage.setItem(ZOOM_PILL_STORAGE_KEY, 'middle')
    expect(createZoomPillStore(storage).load()).toBe('bottom-right')
  })

  it('does not throw where storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(createZoomPillStore(blocked).load()).toBe('bottom-right')
    expect(() => createZoomPillStore(blocked).save('top-left')).not.toThrow()
  })
})

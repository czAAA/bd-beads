import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_ADDED_COLORS } from '../domain/palette'
import { ADDED_COLORS_KEY, browserAddedColorsStore as store } from './addedColorsStore'

beforeEach(() => localStorage.clear())

describe('the added colors store (ticket 227)', () => {
  it('is empty until a color is added', () => {
    expect(store.load()).toEqual([])
  })

  it('keeps the colors in order on this device, across a reload', () => {
    store.save(['#123456', '#abcdef'])
    expect(store.load()).toEqual(['#123456', '#abcdef'])
  })

  it('ignores damaged storage, bad hexes, repeats and anything past the limit', () => {
    localStorage.setItem(ADDED_COLORS_KEY, '{nope')
    expect(store.load()).toEqual([])

    const many = Array.from({ length: MAX_ADDED_COLORS + 5 }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)
    localStorage.setItem(ADDED_COLORS_KEY, JSON.stringify(['#ABCDEF', 'red', 7, '#abcdef', ...many]))
    const loaded = store.load()
    expect(loaded[0]).toBe('#abcdef')
    expect(loaded).toHaveLength(MAX_ADDED_COLORS)
  })
})

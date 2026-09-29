import { beforeEach, describe, expect, it } from 'vitest'
import { loadLocale, saveLocale } from './localeStore'

beforeEach(() => {
  localStorage.clear()
})

describe('localeStorage', () => {
  it('defaults to en when nothing has been saved yet', () => {
    expect(loadLocale()).toBe('en')
  })

  it('round-trips a saved locale', () => {
    saveLocale('en')

    expect(loadLocale()).toBe('en')
  })

  it('ignores corrupted data in storage and falls back to en', () => {
    localStorage.setItem('bd-beads:locale', 'fr')

    expect(loadLocale()).toBe('en')
  })
})

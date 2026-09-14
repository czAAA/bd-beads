import { beforeEach, describe, expect, it } from 'vitest'
import { loadLocale, saveLocale } from './localeStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('localeStorage', () => {
  it('defaults to ru when nothing has been saved yet', () => {
    expect(loadLocale()).toBe('ru')
  })

  it('round-trips a saved locale', () => {
    saveLocale('en')

    expect(loadLocale()).toBe('en')
  })

  it('ignores corrupted data in storage and falls back to ru', () => {
    localStorage.setItem('bd-beads:locale', 'fr')

    expect(loadLocale()).toBe('ru')
  })
})

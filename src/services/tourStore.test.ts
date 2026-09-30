import { beforeEach, describe, expect, it } from 'vitest'
import { loadTourStatus, saveTourStatus } from './tourStore'

describe('tourStore', () => {
  beforeEach(() => localStorage.clear())

  it('starts untouched', () => {
    expect(loadTourStatus()).toBe('untouched')
  })

  it.each(['running', 'finished', 'off'] as const)('remembers %s', (status) => {
    saveTourStatus(status)
    expect(loadTourStatus()).toBe(status)
  })

  it('reads anything else as untouched', () => {
    localStorage.setItem('bd-beads:tour', 'nonsense')
    expect(loadTourStatus()).toBe('untouched')
  })
})

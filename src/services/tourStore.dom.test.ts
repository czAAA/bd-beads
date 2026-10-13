import { beforeEach, describe, expect, it } from 'vitest'
import { loadTourProgress, loadTourStatus, saveTourProgress, saveTourStatus } from './tourStore'

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

describe('tour progress', () => {
  beforeEach(() => localStorage.clear())

  it('starts with nothing done', () => {
    expect(loadTourProgress()).toEqual({ done: [] })
  })

  it('remembers which steps are done and the Project the Tour builds', () => {
    saveTourProgress({ done: ['create', 'fill'], projectId: 'abc' })
    expect(loadTourProgress()).toEqual({ done: ['create', 'fill'], projectId: 'abc' })
  })

  it('ignores steps it does not know and anything unreadable', () => {
    localStorage.setItem('bd-beads:tour-progress', JSON.stringify({ done: ['create', 'nonsense', 7], projectId: 5 }))
    expect(loadTourProgress()).toEqual({ done: ['create'] })
    localStorage.setItem('bd-beads:tour-progress', '{')
    expect(loadTourProgress()).toEqual({ done: [] })
  })
})

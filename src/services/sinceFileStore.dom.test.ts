import { beforeEach, describe, expect, it } from 'vitest'
import { browserSinceFileStore } from './sinceFileStore'

beforeEach(() => localStorage.clear())

describe('browserSinceFileStore (ticket 0796)', () => {
  it('reads back what it wrote', () => {
    browserSinceFileStore.write({ a: { beads: 64, lastFileAt: 5, fileName: 'moth.openbeads' }, b: { beads: 0 } })

    expect(browserSinceFileStore.read()).toEqual({ a: { beads: 64, lastFileAt: 5, fileName: 'moth.openbeads' }, b: { beads: 0 } })
  })

  it('reads a record with no number of beads as none, a count below 0 as 0, and anything unreadable as nothing kept', () => {
    localStorage.setItem('openbeads:since-file', JSON.stringify({ a: { beads: 'x' }, b: { beads: -3, lastFileAt: 'then', fileName: 7 }, c: null }))
    expect(browserSinceFileStore.read()).toEqual({ b: { beads: 0 } })

    localStorage.setItem('openbeads:since-file', '{not json')
    expect(browserSinceFileStore.read()).toEqual({})
  })
})

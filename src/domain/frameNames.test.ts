import { describe, expect, it } from 'vitest'
import { nextFrameName } from './frameNames'

describe('nextFrameName (spec 1214)', () => {
  it('is Frame 1 with no Frame named, and the lowest number no Frame uses after that', () => {
    expect(nextFrameName('Frame {n}', [])).toBe('Frame 1')
    expect(nextFrameName('Frame {n}', ['Frame 1', 'Frame 2'])).toBe('Frame 3')
    expect(nextFrameName('Frame {n}', ['Frame 2', 'Frame 3'])).toBe('Frame 1')
    expect(nextFrameName('Frame {n}', ['Frame 1', 'Frame 3'])).toBe('Frame 2')
  })

  it('counts only the names that read as its own: a typed name, an unnamed Frame and another word use no number', () => {
    expect(nextFrameName('Frame {n}', ['Moth wing', undefined, 'Frame', 'Frame 1 and a half', 'Frame 7'])).toBe('Frame 1')
  })

  it('reads the number from the language\'s own words', () => {
    expect(nextFrameName('Рамка {n}', ['Рамка 1', 'Frame 2'])).toBe('Рамка 2')
    expect(nextFrameName('边框 {n}', ['边框 1'])).toBe('边框 2')
  })
})

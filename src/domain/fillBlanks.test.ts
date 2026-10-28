import { afterEach, describe, expect, it, vi } from 'vitest'
import { fillBlanks } from './fillBlanks'

describe('fillBlanks', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('fills every blank of a string with its value, numbers as written', () => {
    expect(fillBlanks('{columns} × {rows} beads', { columns: 40, rows: '12' })).toBe('40 × 12 beads')
  })

  it('fills a blank each time the string holds it', () => {
    expect(fillBlanks('Leave “{current}”? Your progress on “{current}” is saved.', { current: 'Rose' }))
      .toBe('Leave “Rose”? Your progress on “Rose” is saved.')
  })

  it('puts a value in as it is, even one with a dollar sign', () => {
    expect(fillBlanks('Delete “{name}”?', { name: 'Gift $& more $1' })).toBe('Delete “Gift $& more $1”?')
  })

  it('fails on a blank left with no value', () => {
    expect(() => fillBlanks('{count} beads of {color}', { count: 3 })).toThrow('{color}')
  })

  it('fails on a value the string has no blank for', () => {
    expect(() => fillBlanks('{count} beads', { count: 3, color: 'red' })).toThrow('{color}')
  })

  it('fills an optional value only where the string has its blank', () => {
    expect(fillBlanks('One row added', {}, { count: 1 })).toBe('One row added')
    expect(fillBlanks('{count} rows of {color}', { color: 'red' }, { count: 2 })).toBe('2 rows of red')
  })

  it('in the built app keeps a blank with no value and leaves out a value with no blank', () => {
    vi.stubEnv('DEV', false)
    expect(fillBlanks('{count} beads of {color}', { count: 3, size: 11 })).toBe('3 beads of {color}')
  })
})

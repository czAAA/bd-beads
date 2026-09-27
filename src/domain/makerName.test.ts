import { beforeEach, describe, expect, it } from 'vitest'
import { MAKER_NAME_KEY, MAX_MAKER_NAME, loadMakerName, saveMakerName } from './makerName'

beforeEach(() => localStorage.clear())

describe("the maker's name (ticket 161)", () => {
  it('is empty until one is set', () => {
    expect(loadMakerName()).toBe('')
  })

  it('is kept on this device, trimmed, and survives a reload', () => {
    saveMakerName('  Maria Kovaleva ')

    expect(localStorage.getItem(MAKER_NAME_KEY)).toBe('Maria Kovaleva')
    expect(loadMakerName()).toBe('Maria Kovaleva')
  })

  it('can be changed, and an empty one clears it', () => {
    saveMakerName('Maria')
    saveMakerName('Anna')
    expect(loadMakerName()).toBe('Anna')

    saveMakerName('   ')
    expect(localStorage.getItem(MAKER_NAME_KEY)).toBeNull()
    expect(loadMakerName()).toBe('')
  })

  it('holds at most 40 characters', () => {
    expect(saveMakerName('x'.repeat(60))).toBe('x'.repeat(MAX_MAKER_NAME))
    expect(loadMakerName()).toHaveLength(40)
  })

  it('reads as empty when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked') } }
    expect(loadMakerName(blocked)).toBe('')
  })
})

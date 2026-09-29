import { describe, expect, it } from 'vitest'
import { MAX_MAKER_NAME, normalizeMakerName } from './makerName'

describe('normalizeMakerName', () => {
  it('trims and caps at the field length', () => {
    expect(normalizeMakerName('  Maria ')).toBe('Maria')
    expect(normalizeMakerName('x'.repeat(60))).toBe('x'.repeat(MAX_MAKER_NAME))
  })
})

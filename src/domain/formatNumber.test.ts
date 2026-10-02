import { describe, expect, it } from 'vitest'
import { groupThousands } from './formatNumber'

describe('groupThousands', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1200, '1 200'],
    [1234567, '1 234 567'],
  ])('writes %i as %s, thousands grouped with a no-break space', (value, text) => {
    expect(groupThousands(value)).toBe(text)
  })
})

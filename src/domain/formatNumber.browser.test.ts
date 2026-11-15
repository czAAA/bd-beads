import { describe, expect, it } from 'vitest'
import { formatGrams } from './beadQuantities'
import { decimalSign, groupThousands } from './formatNumber'

// Chromium has no Belarusian number data (ticket 0994, UX-094): Belarusian still writes a decimal comma and groups
// thousands with a no-break space, as Russian does.
describe('Belarusian numbers in a browser (ticket 0994)', () => {
  it('writes a decimal comma', () => {
    expect(decimalSign('be')).toBe(',')
    expect(formatGrams(3.23, 'г', 'be')).toBe('3,3 г')
  })

  it('groups thousands with a no-break space', () => {
    expect(groupThousands(1200, 'be')).toBe('1 200')
  })
})

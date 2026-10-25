import { describe, expect, it } from 'vitest'
import { COFFEE_URL } from './coffeeLink'

describe('the Coffee link (ticket 560)', () => {
  it('is one public https page, with no query or script', () => {
    expect(COFFEE_URL).toMatch(/^https:\/\/buymeacoffee\.com\/[a-z0-9]+$/)
  })
})

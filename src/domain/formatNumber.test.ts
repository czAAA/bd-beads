import { describe, expect, it } from 'vitest'
import { decimalSign, groupThousands, inMillions } from './formatNumber'

describe('groupThousands', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1200, '1\u00a0200'],
  ])('writes %i with a no-break space in English', (value, text) => {
    expect(groupThousands(value)).toBe(text)
  })

  it('keeps English and Russian as they were: thousands grouped with a no-break space', () => {
    expect(groupThousands(1234567)).toBe('1 234 567')
    expect(groupThousands(1234567, 'ru')).toBe('1 234 567')
  })

  it.each([
    ['pl', '1 200'],
    ['es', '1.200'],
    ['zh', '1,200'],
  ] as const)('writes four-digit counts the way %s writes them', (locale, text) => {
    expect(groupThousands(1200, locale)).toBe(text)
  })
})

describe('decimalSign', () => {
  it.each([
    ['en', '.'],
    ['zh', '.'],
    ['ru', ','],
    ['es', ','],
    ['pl', ','],
    ['uk', ','],
    ['be', ','],
  ] as const)('is %s\'s own sign: %s', (locale, sign) => {
    expect(decimalSign(locale)).toBe(sign)
  })
})

describe('inMillions (ticket 0716)', () => {
  it('cuts a count down to whole millions from ten million, and to one decimal under it', () => {
    expect(inMillions(31_771_024)).toBe('31')
    expect(inMillions(2_512_000, 'ru')).toBe('2,5')
    expect(inMillions(2_000_900)).toBe('2')
  })
})

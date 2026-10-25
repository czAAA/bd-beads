import { describe, expect, it } from 'vitest'
import { textWidth } from './textWidth'

// Widths Chromium reports for the same text in the same bundled fonts (measured once with Playwright, ticket 552).
const IN_A_BROWSER: [string, number, number, number][] = [
  ['Right-angle weave', 14, 500, 124.69],
  ['Создать бесплатный аккаунт', 14, 500, 202.78],
  ['Zapisz wzór na później', 13, 500, 142.77],
  ['Hello world, AV To Wa', 14, 400, 146.23],
  ['Ткачество, мозаика, кирпич', 16, 600, 226.64],
  ['Ñandú, ¿qué tal? Łódź żółć', 12, 500, 154.84],
]

describe('textWidth', () => {
  it.each(IN_A_BROWSER)('%s at %ipx/%i is as wide as in a browser', (text, size, weight, expected) => {
    const { width, estimated } = textWidth(text, { size, weight })
    expect(estimated).toBe(false)
    expect(Math.abs(width - expected)).toBeLessThan(Math.max(1, expected * 0.01))
  })

  it('counts Chinese as one em per character and says it is an estimate', () => {
    expect(textWidth('保存图案', { size: 14, weight: 500 })).toEqual({ width: 56, estimated: true })
  })
})

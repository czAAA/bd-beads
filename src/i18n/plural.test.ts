import { describe, expect, it } from 'vitest'
import { groupThousands } from '../domain/formatNumber'
import { plural } from './plural'

describe('plural', () => {
  it('takes one and other in English', () => {
    const forms = { one: '{count} column', other: '{count} columns' }
    expect(plural('en', 1, forms)).toBe('1 column')
    expect(plural('en', 40, forms)).toBe('40 columns')
  })

  it('takes one, few and many in Russian', () => {
    const forms = { one: '{count} столбец', few: '{count} столбца', many: '{count} столбцов', other: '{count} столбца' }
    expect(plural('ru', 1, forms)).toBe('1 столбец')
    expect(plural('ru', 21, forms)).toBe('21 столбец')
    expect(plural('ru', 3, forms)).toBe('3 столбца')
    expect(plural('ru', 40, forms)).toBe('40 столбцов')
    expect(plural('ru', 11, forms)).toBe('11 столбцов')
  })

  it.each([
    ['uk', 1, '1 колір'],
    ['uk', 3, '3 кольори'],
    ['uk', 5, '5 кольорів'],
    ['be', 2, '2 колеры'],
    ['be', 11, '11 колераў'],
    ['pl', 1, '1 kolor'],
    ['pl', 3, '3 kolory'],
    ['pl', 12, '12 kolorów'],
    ['es', 5, '5 colores'],
    ['zh', 7, '7 种颜色'],
  ] as const)('takes the forms %s needs: %i is "%s"', (locale, count, text) => {
    const forms = {
      uk: { one: '{count} колір', few: '{count} кольори', many: '{count} кольорів', other: '{count} кольору' },
      be: { one: '{count} колер', few: '{count} колеры', many: '{count} колераў', other: '{count} колеру' },
      pl: { one: '{count} kolor', few: '{count} kolory', many: '{count} kolorów', other: '{count} koloru' },
      es: { one: '{count} color', other: '{count} colores' },
      zh: { other: '{count} 种颜色' },
    }[locale]
    expect(plural(locale, count, forms)).toBe(text)
  })

  it('groups thousands with a no-break space', () => {
    expect(groupThousands(1200)).toBe('1 200')
    expect(groupThousands(999)).toBe('999')
    expect(plural('en', 12500, { other: '{count} rows' })).toBe('12 500 rows')
  })
})

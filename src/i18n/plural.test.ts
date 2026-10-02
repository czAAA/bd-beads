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

  it('groups thousands with a no-break space', () => {
    expect(groupThousands(1200)).toBe('1 200')
    expect(groupThousands(999)).toBe('999')
    expect(plural('en', 12500, { other: '{count} rows' })).toBe('12 500 rows')
  })
})

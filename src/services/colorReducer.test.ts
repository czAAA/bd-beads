import { describe, expect, it } from 'vitest'
import { createColorReducer } from './colorReducer'

describe('createColorReducer (ticket 1163)', () => {
  it('reduces on the spot where the browser has no worker', () => {
    let reduced
    createColorReducer().reduce(
      { counts: new Map([['#000000', 3], ['#ffffff', 2]]), asked: 12, targets: undefined, choices: new Map(), leastBeads: 0 },
      (result) => (reduced = result),
    )
    expect(reduced).toMatchObject({ colors: [{ hex: '#000000', count: 3 }, { hex: '#ffffff', count: 2 }] })
  })
})

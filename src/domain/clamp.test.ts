import { describe, expect, it } from 'vitest'
import { clamp } from './clamp'

describe('clamp', () => {
  it('keeps a value inside its range and holds one outside at the nearer end', () => {
    expect([clamp(0.4, 0, 1), clamp(-2, 0, 1), clamp(7, 0, 1)]).toEqual([0.4, 0, 1])
  })
})

import { describe, expect, it } from 'vitest'
import { pointerDraws } from './inputMode'

describe('pointerDraws', () => {
  it('lets only the pen draw in Pen mode', () => {
    expect(pointerDraws('pen', 'pen')).toBe(true)
    expect(pointerDraws('pen', 'touch')).toBe(false)
    expect(pointerDraws('pen', 'mouse')).toBe(false)
  })

  it('lets a finger or mouse draw, and not the pen, in Mouse mode', () => {
    expect(pointerDraws('mouse', 'touch')).toBe(true)
    expect(pointerDraws('mouse', 'mouse')).toBe(true)
    expect(pointerDraws('mouse', 'pen')).toBe(false)
  })
})

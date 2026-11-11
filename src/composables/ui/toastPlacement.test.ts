import { describe, expect, it } from 'vitest'
import { toastsBelowPanel } from './toastPlacement'

const room = { left: 0, right: 1000, top: 100, bottom: 900 }
const toasts = { left: 560, right: 984, top: 160, bottom: 220 }

describe('toastsBelowPanel (ticket 0859)', () => {
  it('starts the toasts at the bottom of a panel over their column, from the top of their box', () => {
    expect(toastsBelowPanel({ left: 620, right: 984, top: 144, bottom: 400 }, toasts, room)).toBe(300)
  })

  it('leaves them in place beside a panel that misses their column', () => {
    expect(toastsBelowPanel({ left: 16, right: 376, top: 144, bottom: 800 }, toasts, room)).toBeUndefined()
  })

  it('leaves them on top where a tall panel would push them out of the box', () => {
    expect(toastsBelowPanel({ left: 8, right: 992, top: 144, bottom: 860 }, toasts, room)).toBeUndefined()
  })
})

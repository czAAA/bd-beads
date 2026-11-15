import { describe, expect, it } from 'vitest'
import { roomBesidePanel } from './roomBesidePanel'

const area = { x: 0, y: 46, width: 1366, height: 930 }

describe('roomBesidePanel (ticket 0971)', () => {
  it('leaves the wider side beside the panel, with air at its edge', () => {
    // The iPad's Frame panel hangs from the strip's Frame button, 288 to 853.
    expect(roomBesidePanel({ x: 288, y: 50, width: 565, height: 900 }, area)).toEqual({ top: 0, right: 0, bottom: 0, left: 853 + 16 })
  })

  it('leaves the left side when it is the wider', () => {
    expect(roomBesidePanel({ x: 800, y: 50, width: 500, height: 900 }, area)).toEqual({ top: 0, right: 1366 - 800 + 16, bottom: 0, left: 0 })
  })

  it('takes nothing for a panel off the area', () => {
    expect(roomBesidePanel({ x: 288, y: 0, width: 565, height: 40 }, area)).toBeUndefined()
  })

  it('takes nothing where the free side is too narrow, as a phone\'s panel across the screen leaves', () => {
    expect(roomBesidePanel({ x: 8, y: 50, width: 374, height: 600 }, { x: 0, y: 46, width: 390, height: 700 })).toBeUndefined()
  })
})

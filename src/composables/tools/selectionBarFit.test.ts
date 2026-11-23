import { describe, expect, it } from 'vitest'
import { type BarFitInput, fitItems } from './selectionBarFit'

// A phone's bar as measured (ticket 1206): 36px buttons, an 8px gap, 4px padding, a 7px divider, a grip of one button.
const phone = (room: number, lead: number[], groups: number[]): BarFitInput => ({ room, button: 36, gap: 8, side: 4, divider: 7, lead, groups })
const groups = [0, 1, 1, 2, 2, 2, 2, 3]

describe('fitItems', () => {
  it('shows every item when they all fit, with no "…"', () => {
    expect(fitItems(phone(1000, [36], groups))).toBe(groups.length)
  })

  it('counts every divider and gap, and keeps the room for "…"', () => {
    // lead 36, divider 7, one item 36, divider 7, "…" 36, four gaps x 8, padding 8 = 162
    expect(fitItems(phone(162, [36], groups))).toBe(1)
    expect(fitItems(phone(161, [36], groups))).toBe(0)
  })

  it('shows more once the readout leaves the lead', () => {
    const withReadout = fitItems(phone(372, [36, 172], groups))
    const without = fitItems(phone(372, [36], groups))
    expect(without).toBeGreaterThan(withReadout)
  })
})

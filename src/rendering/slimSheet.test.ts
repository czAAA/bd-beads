import { describe, expect, it } from 'vitest'
import { slimSheetSides, type SlimContent } from './slimSheet'

const content = (over: Partial<SlimContent> = {}): SlimContent => ({ compact: false, row: 28, foot: 47, numbers: { left: 13, top: 11 }, rowWidth: 0, fontPx: 11, ...over })

describe('slimSheetSides', () => {
  it('holds the row, the column numbers and the foot, and the row numbers on the left (MarginSheet card, Expand the Frame)', () => {
    // Top: 6 inset, 28 row, 3, 11 numbers, 3 to the line. Left: 6 inset, 13 numbers, 3. Right: the inset. Bottom: 6, 47, 6.
    expect(slimSheetSides(content(), 400)).toEqual({ top: 51, left: 22, right: 6, bottom: 59 })
  })

  it('takes the smaller inset under bp-tablet', () => {
    expect(slimSheetSides(content({ compact: true, row: 24, foot: 22 }), 300)).toEqual({ top: 45, left: 20, right: 4, bottom: 30 })
  })

  it('leaves a side without numbers or foot its inset alone', () => {
    expect(slimSheetSides(content({ numbers: { left: 0, top: 0 }, foot: 0 }), 400)).toEqual({ top: 40, left: 6, right: 6, bottom: 6 })
  })

  it('is never narrower than its row: a narrow Frame keeps the row whole, the sheet centred on it', () => {
    // 100 of line, 22 and 6 of sides: 128, where the row and its insets need 228, so 50 more on each side.
    expect(slimSheetSides(content({ rowWidth: 216 }), 100)).toEqual({ top: 51, left: 72, right: 56, bottom: 59 })
  })

  it('fills its room: the spare width goes evenly to both sides and the spare height to the top band and the bottom strip', () => {
    // A line of 100 by 200 in a room of 300 by 400: sides of 22 and 6 across, 51 and 59 down.
    expect(slimSheetSides(content({ fill: { width: 300, height: 400 } }), 100, 200)).toEqual({ top: 51 + 45, left: 22 + 86, right: 6 + 86, bottom: 59 + 45 })
  })

  it('does not shrink under a room smaller than it needs', () => {
    expect(slimSheetSides(content({ fill: { width: 50, height: 50 } }), 400, 400)).toEqual({ top: 51, left: 22, right: 6, bottom: 59 })
  })
})

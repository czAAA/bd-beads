import { describe, expect, it } from 'vitest'
import { slimSheetSides, type SlimContent } from './slimSheet'

const content = (over: Partial<SlimContent> = {}): SlimContent => ({ compact: false, row: 28, title: 47, numbers: { left: 13, top: 11 }, rowWidth: 0, ...over })

describe('slimSheetSides', () => {
  it('holds the row, the column numbers and the title block, and the row numbers on the left (MarginSheet card, Expand the Frame)', () => {
    // Top: 6 inset, 28 row, 3, 11 numbers, 3 to the line. Left: 6 inset, 13 numbers, 3. Right: the inset. Bottom: 6, 47, 6.
    expect(slimSheetSides(content(), 400)).toEqual({ top: 51, left: 22, right: 6, bottom: 59 })
  })

  it('takes the smaller inset under bp-tablet', () => {
    expect(slimSheetSides(content({ compact: true, row: 24, title: 22 }), 300)).toEqual({ top: 45, left: 20, right: 4, bottom: 30 })
  })

  it('leaves a side without numbers or title block its inset alone', () => {
    expect(slimSheetSides(content({ numbers: { left: 0, top: 0 }, title: 0 }), 400)).toEqual({ top: 40, left: 6, right: 6, bottom: 6 })
  })

  it('is never narrower than its row: a narrow Frame keeps the row whole, the sheet centred on it', () => {
    // 100 of line, 22 and 6 of sides: 128, where the row and its insets need 228, so 50 more on each side.
    expect(slimSheetSides(content({ rowWidth: 216 }), 100)).toEqual({ top: 51, left: 72, right: 56, bottom: 59 })
  })
})

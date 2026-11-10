import { describe, expect, it } from 'vitest'
import { shownMarkLabels } from './sliderMarkLabels'

describe('shownMarkLabels (ValueSlider card, ticket 0862)', () => {
  const ends = [
    { from: 0, to: 10 },
    { from: 290, to: 300 },
  ]

  it('shows every label that keeps clear of the ends and of the others', () => {
    expect(shownMarkLabels([{ from: 40, to: 100 }, { from: 150, to: 210 }], ends, 8)).toEqual([true, true])
  })

  it('leaves out a label that would touch one kept before it, as "30 beads" and "60 beads" did', () => {
    expect(shownMarkLabels([{ from: 100, to: 164 }, { from: 154, to: 218 }, { from: 230, to: 280 }], ends, 8)).toEqual([true, false, true])
  })

  it('leaves out a label closer than the gap, even when they do not overlap', () => {
    expect(shownMarkLabels([{ from: 100, to: 160 }, { from: 164, to: 220 }], ends, 8)).toEqual([true, false])
  })

  it('leaves out a label that would touch an end’s label', () => {
    expect(shownMarkLabels([{ from: 4, to: 40 }, { from: 250, to: 286 }], ends, 8)).toEqual([false, false])
  })
})

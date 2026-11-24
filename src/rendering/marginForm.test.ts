import { describe, expect, it } from 'vitest'
import { marginForm, marginScale } from './marginForm'
import { MARGIN_PX } from './marginSizes'

describe('the margin sheet\'s scale by its band (tickets 0698, 0851)', () => {
  it('is the band over the drafting sheet\'s 80px, held between 1 and 1.5 (ticket 1213: 72px until the legend took two lines)', () => {
    expect([80, 100, 72, 120, 200, 40, 30, 8].map((band) => marginScale(band))).toEqual([1, 1.25, 1, 1.5, 1.5, 1, 1, 1])
  })
})

describe('the margin sheet\'s form by its band (MarginSheet card, Zoom forms, tickets 0658, 0698, 0851)', () => {
  it('is full at every scale it can take, so the controls grow with the beads rather than change form', () => {
    expect([200, 120, 100, 80].map((band) => marginForm(band))).toEqual(['full', 'full', 'full', 'full'])
  })

  it('under the smallest scale steps down where its band no longer holds a form at that scale: compact, folded, then bare', () => {
    // The forms' 80 (ticket 1213: the title row, its legend in two lines, on Row progress's strip), 40 and 31px, at 1.
    expect([80, 79.9, 40, 39.9, 31, 30.9, 8].map((band) => marginForm(band))).toEqual(['full', 'compact', 'compact', 'folded', 'folded', 'bare', 'bare'])
  })

  it('at the Homepage demo\'s least scale, 0.6, shrinks to it before it steps down (ticket 0851)', () => {
    const { demo } = MARGIN_PX.scale
    expect([60, 48, 47.9, 24, 23.9, 18.6, 18.5].map((band) => marginForm(band, demo))).toEqual(['full', 'full', 'compact', 'compact', 'folded', 'folded', 'bare'])
    expect(marginScale(30, demo)).toBe(demo)
  })
})

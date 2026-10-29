import { describe, expect, it } from 'vitest'
import { marginForm, marginScale } from './marginForm'

describe('the margin sheet\'s scale by its band (ticket 0698)', () => {
  it('is the band over the drafting sheet\'s 72px, held between 0.6 and 1.5', () => {
    expect([72, 90, 54, 108, 200, 40, 30, 8].map(marginScale)).toEqual([1, 1.25, 0.75, 1.5, 1.5, 0.6, 0.6, 0.6])
  })
})

describe('the margin sheet\'s form by its band (MarginSheet card, Zoom forms, tickets 0658, 0698)', () => {
  it('is full at every scale it can take, so the controls shrink with the beads rather than change form', () => {
    expect([200, 108, 80, 72, 60, 43.2].map(marginForm)).toEqual(['full', 'full', 'full', 'full', 'full', 'full'])
  })

  it('under the smallest scale steps down where its band no longer holds a form at that scale: compact, folded, then bare', () => {
    // The forms' 68, 40 and 31px, at 0.6.
    expect([40.8, 40.7, 24, 23.9, 18.6, 18.5, 8].map(marginForm)).toEqual(['full', 'compact', 'compact', 'folded', 'folded', 'bare', 'bare'])
  })
})

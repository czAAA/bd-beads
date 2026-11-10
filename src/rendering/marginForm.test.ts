import { describe, expect, it } from 'vitest'
import { marginForm, marginScale, titleBlockCorner } from './marginForm'
import { MARGIN_PX } from './marginSizes'
import { OPEN_SPACE } from './space'
import { surfaceView } from './surfaceView'

describe('the margin sheet\'s scale by its band (tickets 0698, 0851)', () => {
  it('is the band over the drafting sheet\'s 72px, held between 1 and 1.5', () => {
    expect([72, 90, 54, 108, 200, 40, 30, 8].map((band) => marginScale(band))).toEqual([1, 1.25, 1, 1.5, 1.5, 1, 1, 1])
  })
})

describe('the margin sheet\'s form by its band (MarginSheet card, Zoom forms, tickets 0658, 0698, 0851)', () => {
  it('is full at every scale it can take, so the controls grow with the beads rather than change form', () => {
    expect([200, 108, 80, 72].map((band) => marginForm(band))).toEqual(['full', 'full', 'full', 'full'])
  })

  it('under the smallest scale steps down where its band no longer holds a form at that scale: compact, folded, then bare', () => {
    // The forms' 68, 40 and 31px, at 1.
    expect([68, 67.9, 40, 39.9, 31, 30.9, 8].map((band) => marginForm(band))).toEqual(['full', 'compact', 'compact', 'folded', 'folded', 'bare', 'bare'])
  })

  it('at the Homepage demo\'s least scale, 0.6, shrinks to it before it steps down (ticket 0851)', () => {
    const { demo } = MARGIN_PX.scale
    expect([60, 43.2, 40.7, 24, 23.9, 18.6, 18.5].map((band) => marginForm(band, demo))).toEqual(['full', 'full', 'compact', 'compact', 'folded', 'folded', 'bare'])
    expect(marginScale(30, demo)).toBe(demo)
  })
})

describe('the title block\'s corner as the Canvas turns (ticket 0728)', () => {
  it('is the Frame\'s own bottom-right at each quarter turn: bottom-right, bottom-left, top-left, top-right on screen', () => {
    const at = (rotation: 0 | 90 | 180 | 270) => titleBlockCorner(surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation, zoom: 1, viewport: { width: 400, height: 400 } }))
    expect([0, 90, 180, 270].map((rotation) => at(rotation as 0 | 90 | 180 | 270))).toEqual([
      { top: false, left: false },
      { top: false, left: true },
      { top: true, left: true },
      { top: true, left: false },
    ])
  })
})

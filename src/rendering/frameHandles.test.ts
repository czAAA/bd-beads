import { describe, expect, it } from 'vitest'
import { areaHandles, areaPressAt, AREA_SHEET_OUTSET, boxPressAt, frameHandles, framePressAt, handleAt, handleEdges, handleIdAt, hitRadius } from './frameHandles'

const box = { x: 100, y: 50, width: 200, height: 100 }

describe('frame handles', () => {
  it('are eight round the rectangle with a pointer: corners and the middles of the sides', () => {
    const handles = frameHandles(box, false)

    expect(handles.map((h) => h.id)).toEqual(['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'])
    expect(handles.find((h) => h.id === 'top')).toMatchObject({ x: 200, y: 50 })
    expect(handles.find((h) => h.id === 'bottom-right')).toMatchObject({ x: 300, y: 150 })
  })

  it('are the four corners on touch', () => {
    const handles = frameHandles(box, true)

    expect(handles.map((h) => h.id)).toEqual(['top-left', 'top-right', 'bottom-right', 'bottom-left'])
  })

  it('stand on an area\'s sheet\'s outer edge: 10px out on every side (tickets 0807, 0808, 0812)', () => {
    const out = areaHandles(box, false, AREA_SHEET_OUTSET)
    expect(out.find((h) => h.id === 'top-left')).toMatchObject({ x: 90, y: 40 })
    expect(out.find((h) => h.id === 'top')).toMatchObject({ x: 200, y: 40 })
    expect(out.find((h) => h.id === 'bottom-right')).toMatchObject({ x: 310, y: 160 })
  })

  it('grab an area at its sheet\'s corners and edges; its inside moves it, the band is the canvas\'s (ticket 0808)', () => {
    const outset = AREA_SHEET_OUTSET
    expect(areaPressAt(box, 0, { x: 92, y: 42 }, false, outset)).toEqual({ kind: 'handle', edges: ['top', 'left'] })
    expect(areaPressAt(box, 0, { x: 310, y: 100 }, false, outset)).toEqual({ kind: 'handle', edges: ['right'] })
    expect(handleIdAt(box, { x: 308, y: 158 }, false, outset)).toBe('bottom-right')
    expect(areaPressAt(box, 0, { x: 150, y: 70 }, false, outset)).toEqual({ kind: 'inside' })
    expect(areaPressAt(box, 0, { x: 150, y: 20 }, false, outset)).toEqual({ kind: 'outside' })
  })

  it('measure their reach on the sheet, so a tiny area keeps handles that can be grabbed (ticket 0808)', () => {
    const small = { x: 100, y: 100, width: 12, height: 12 }
    // The sheet is 32 × 32: a third of 32 is the reach, not a third of the area's 12.
    expect(handleIdAt(small, { x: 96, y: 96 }, false, AREA_SHEET_OUTSET)).toBe('top-left')
  })

  it('are grabbed within 14px of their centre with a pointer and 24px with a finger, and not away from them', () => {
    const handles = frameHandles(box, false)

    expect(handleAt(handles, { x: 100, y: 50 }, 14)?.id).toBe('top-left')
    expect(handleAt(handles, { x: 110, y: 58 }, 14)?.id).toBe('top-left')
    expect(handleAt(handles, { x: 200, y: 100 }, 14)).toBeUndefined()
    expect(hitRadius(box, false)).toBe(14)
    expect(hitRadius(box, true)).toBe(24 > 100 / 3 ? 100 / 3 : 24)
  })

  it('give the nearest handle, but a corner in reach beats an edge handle that is nearer', () => {
    const wide = { x: 0, y: 0, width: 60, height: 300 }
    const handles = frameHandles(wide, false)

    // Nearer the top edge’s middle (30, 0) than the corner (0, 0), yet the corner is within reach.
    expect(handleAt(handles, { x: 16, y: 0 }, 16)?.id).toBe('top-left')
    // Out of any corner's reach, the edge handle wins.
    expect(handleAt(handles, { x: 30, y: 4 }, 10)?.id).toBe('top')
  })

  it('cap their reach at a third of the shorter side, so a small rectangle keeps an inside to move', () => {
    const small = { x: 100, y: 100, width: 30, height: 60 }

    expect(hitRadius(small, false)).toBe(10)
    expect(hitRadius(small, true)).toBe(10)
    expect(boxPressAt(small, 0, { x: 115, y: 130 }, false)).toEqual({ kind: 'inside' })
  })

  it('give a press inside the rectangle, within a corner’s reach, that corner', () => {
    expect(boxPressAt(box, 0, { x: 108, y: 58 }, false)).toEqual({ kind: 'handle', edges: ['top', 'left'] })
    expect(boxPressAt(box, 0, { x: 200, y: 100 }, false)).toEqual({ kind: 'inside' })
    expect(boxPressAt(box, 0, { x: 20, y: 20 }, false)).toEqual({ kind: 'outside' })
  })

  it('reach further on touch, where only the corners are handles', () => {
    expect(boxPressAt(box, 0, { x: 115, y: 65 }, true)).toEqual({ kind: 'handle', edges: ['top', 'left'] })
    expect(boxPressAt(box, 0, { x: 115, y: 65 }, false)).toEqual({ kind: 'inside' })
    // The middle of a side is no handle on touch.
    expect(boxPressAt(box, 0, { x: 200, y: 50 }, true)).toEqual({ kind: 'inside' })
  })

  it('drag the sides they stand on, a corner two', () => {
    expect(handleEdges(0, 'left')).toEqual(['left'])
    expect(handleEdges(0, 'bottom-right')).toEqual(['bottom', 'right'])
  })

  it('drag the Frame’s own edge once the picture is turned: its top is on the right after a quarter turn', () => {
    expect(handleEdges(90, 'right')).toEqual(['top'])
    expect(handleEdges(90, 'top-left')).toEqual(['left', 'bottom'])
    expect(handleEdges(180, 'top')).toEqual(['bottom'])
    expect(handleEdges(270, 'left')).toEqual(['top'])
  })
})

describe('the Frame\'s handles on its line (MarginSheet card, ticket 0657)', () => {
  it('are grabbed on the line\'s corners and edges, and a press on one wins over the Frame\'s inside', () => {
    const frame = { row: 0, column: 0, rows: 1, columns: 1 }
    const surface = { frameBox: () => box }

    expect(framePressAt(frame, surface, 0, { x: 300, y: 150 }, false)).toEqual({ kind: 'handle', edges: ['bottom', 'right'] })
    expect(framePressAt(frame, surface, 0, { x: 309, y: 159 }, false)).toEqual({ kind: 'handle', edges: ['bottom', 'right'] })
    expect(framePressAt(frame, surface, 0, { x: 200, y: 52 }, false)).toEqual({ kind: 'handle', edges: ['top'] })
    expect(framePressAt(frame, surface, 0, { x: 200, y: 100 }, false)).toEqual({ kind: 'inside' })
    expect(framePressAt(undefined, surface, 0, { x: 300, y: 150 }, false)).toEqual({ kind: 'outside' })
  })
})

import { describe, expect, it } from 'vitest'
import { boxPressAt, frameHandles, framePressAt, gutterHandles, handleAt, handleEdges, hitRadius, HANDLE_PX, TOUCH_HANDLE_PX } from './frameHandles'

const box = { x: 100, y: 50, width: 200, height: 100 }

describe('frame handles', () => {
  it('are eight 9px squares round the rectangle with a pointer: corners and the middles of the sides', () => {
    const handles = frameHandles(box, false)

    expect(handles.map((h) => h.id)).toEqual(['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'])
    expect(handles.every((h) => h.size === HANDLE_PX)).toBe(true)
    expect(handles.find((h) => h.id === 'top')).toMatchObject({ x: 200, y: 50 })
    expect(handles.find((h) => h.id === 'bottom-right')).toMatchObject({ x: 300, y: 150 })
  })

  it('are four 16px corner handles on touch', () => {
    const handles = frameHandles(box, true)

    expect(handles.map((h) => h.id)).toEqual(['top-left', 'top-right', 'bottom-right', 'bottom-left'])
    expect(handles.every((h) => h.size === TOUCH_HANDLE_PX)).toBe(true)
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

describe('the Frame\'s handles in its gutter (ADR 0066)', () => {
  const viewport = { width: 600, height: 400 }

  it('stand just outside the edge, each moved out by half its square and a gap', () => {
    const handles = gutterHandles(box, false, viewport)

    expect(handles.find((h) => h.id === 'top')).toMatchObject({ x: 200, y: 50 - 7.5 })
    expect(handles.find((h) => h.id === 'left')).toMatchObject({ x: 100 - 7.5, y: 100 })
    expect(handles.find((h) => h.id === 'bottom-right')).toMatchObject({ x: 307.5, y: 157.5 })
    expect(gutterHandles(box, true, viewport).find((h) => h.id === 'top-left')).toMatchObject({ x: 100 - 11, y: 50 - 11 })
  })

  it('keep their size and distance from the edge at every zoom: only the box moves them', () => {
    const big = { x: 100, y: 50, width: 2000, height: 1000 }
    const handles = gutterHandles(big, false, { width: 4000, height: 2000 })

    expect(handles.find((h) => h.id === 'top-left')).toMatchObject({ x: 92.5, y: 42.5, size: HANDLE_PX })
  })

  it('flip to the inside of an edge that has no room outside it in the canvas box', () => {
    const atEdge = { x: 2, y: 3, width: 200, height: 100 }
    const handles = gutterHandles(atEdge, false, viewport)

    expect(handles.find((h) => h.id === 'top-left')).toMatchObject({ x: 9.5, y: 10.5 })
    expect(handles.find((h) => h.id === 'bottom-right')).toMatchObject({ x: 209.5, y: 110.5 })
    const flush = gutterHandles({ x: 400, y: 300, width: 200, height: 100 }, false, viewport)
    expect(flush.find((h) => h.id === 'bottom-right')).toMatchObject({ x: 592.5, y: 392.5 })
  })

  it('are grabbed from the gutter, and a press on one wins over the Frame\'s inside', () => {
    const frame = { row: 0, column: 0, rows: 1, columns: 1 }
    const surface = { frameBox: () => box, viewport }

    expect(framePressAt(frame, surface, 0, { x: 307, y: 157 }, false)).toEqual({ kind: 'handle', edges: ['bottom', 'right'] })
    expect(framePressAt(frame, surface, 0, { x: 299, y: 149 }, false)).toEqual({ kind: 'handle', edges: ['bottom', 'right'] })
    expect(framePressAt(frame, surface, 0, { x: 200, y: 100 }, false)).toEqual({ kind: 'inside' })
    expect(framePressAt(undefined, surface, 0, { x: 307, y: 157 }, false)).toEqual({ kind: 'outside' })
  })
})

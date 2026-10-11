import { describe, expect, it } from 'vitest'
import { frameHandles, handleAt, handleEdges, HANDLE_PX, TOUCH_HANDLE_PX } from './frameHandles'

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

  it('are found under a point, with a little slack, and not away from them', () => {
    const handles = frameHandles(box, false)

    expect(handleAt(handles, { x: 100, y: 50 })?.id).toBe('top-left')
    expect(handleAt(handles, { x: 107, y: 52 })?.id).toBe('top-left')
    expect(handleAt(handles, { x: 200, y: 100 })).toBeUndefined()
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

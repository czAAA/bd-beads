// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Weave } from '../domain/weave'
import { OPEN_SPACE } from './space'
import { surfaceView } from './surfaceView'
import { axisAtGridPx, axisGridPx, axisHandleAt, axisHandles, MIRROR_HANDLE_PX } from './mirrorAxes'

const LOOM: Weave = { technique: 'loom' }
const BRICK: Weave = { technique: 'brick' }

/** The open Canvas in a 400 × 300 viewport. */
function view(zoom = 1, rotation: Rotation = 0, viewport = { width: 400, height: 300 }, scroll = { x: 0, y: 0 }) {
  return surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation, zoom, scroll, viewport })
}

describe('a Canvas Axis in grid px (ticket 0704)', () => {
  it('runs through a loom position\'s centre at a whole number and its boundary at a half, and reads back from px', () => {
    expect(axisGridPx(LOOM, 'leftRight', 3)).toBe(70)
    expect(axisGridPx(LOOM, 'leftRight', 2.5)).toBe(60)
    expect(axisGridPx(LOOM, 'topBottom', 0)).toBe(10)
    expect(axisAtGridPx(LOOM, 'leftRight', 70)).toBe(3)
    expect(axisAtGridPx(LOOM, 'topBottom', 10)).toBe(0)
  })

  it('reads back what it wrote on brick, whose rows nest and shift', () => {
    for (const at of [0, 1.5, -3]) {
      expect(axisAtGridPx(BRICK, 'topBottom', axisGridPx(BRICK, 'topBottom', at))).toBeCloseTo(at, 9)
      expect(axisAtGridPx(BRICK, 'leftRight', axisGridPx(BRICK, 'leftRight', at))).toBeCloseTo(at, 9)
    }
  })
})

describe('the Axis handles (ticket 0704, MirrorPopover card)', () => {
  it('stands a 32px chip on each line 56px in from the edge it enters the view at, whatever the zoom', () => {
    expect(axisHandles({ leftRight: 3, topBottom: 8 }, LOOM, view())).toEqual([
      { axis: 'leftRight', x: 70, y: 56, size: MIRROR_HANDLE_PX },
      { axis: 'topBottom', x: 56, y: 170, size: MIRROR_HANDLE_PX },
    ])
    expect(axisHandles({ leftRight: 3 }, LOOM, view(2))).toEqual([{ axis: 'leftRight', x: 140, y: 56, size: MIRROR_HANDLE_PX }])
  })

  it('follows the view\'s turn: a Left–right Axis is a horizontal line on a quarter-turned Canvas, its chip in from the edge', () => {
    const [handle] = axisHandles({ leftRight: 3 }, LOOM, view(1, 90))
    expect(handle!.axis).toBe('leftRight')
    expect(handle!.y).toBe(70)
    expect([handle!.x, 400 - handle!.x]).toContain(56)
  })

  it('never lets the two chips share a spot: the Top–bottom chip steps along its line past the other', () => {
    expect(axisHandles({ leftRight: 2.5, topBottom: 2.5 }, LOOM, view())).toEqual([
      { axis: 'leftRight', x: 60, y: 56, size: MIRROR_HANDLE_PX },
      { axis: 'topBottom', x: 136, y: 60, size: MIRROR_HANDLE_PX },
    ])
  })

  it('leaves out an Axis that is out of view, and centres the chip on a line shorter than twice the inset', () => {
    expect(axisHandles({ leftRight: 100, topBottom: 2 }, LOOM, view())).toEqual([{ axis: 'topBottom', x: 56, y: 50, size: MIRROR_HANDLE_PX }])
    expect(axisHandles({ leftRight: 3 }, LOOM, view(1, 0, { width: 400, height: 40 }))).toEqual([{ axis: 'leftRight', x: 70, y: 20, size: MIRROR_HANDLE_PX }])
    expect(axisHandles({}, LOOM, view())).toEqual([])
  })

  it('is grabbed within its own radius by a mouse, further by a finger', () => {
    const handles = axisHandles({ leftRight: 3, topBottom: 8 }, LOOM, view())
    expect(axisHandleAt(handles, { x: 72, y: 60 }, false)?.axis).toBe('leftRight')
    expect(axisHandleAt(handles, { x: 90, y: 60 }, false)).toBeUndefined()
    expect(axisHandleAt(handles, { x: 90, y: 60 }, true)?.axis).toBe('leftRight')
    expect(axisHandleAt(handles, { x: 56, y: 172 }, false)?.axis).toBe('topBottom')
  })

  it('stands the centre chip on Radial\'s centre itself, a position\'s centre or a corner between four, none out of view (ticket 0705)', () => {
    expect(axisHandles({ centre: { row: 2, column: 3 } }, LOOM, view())).toEqual([{ axis: 'radial', x: 70, y: 50, size: MIRROR_HANDLE_PX }])
    expect(axisHandles({ centre: { row: 1.5, column: 2.5 } }, LOOM, view(2))).toEqual([{ axis: 'radial', x: 120, y: 80, size: MIRROR_HANDLE_PX }])
    expect(axisHandles({ centre: { row: 20, column: 3 } }, LOOM, view())).toEqual([])
    expect(axisHandleAt(axisHandles({ centre: { row: 2, column: 3 } }, LOOM, view()), { x: 80, y: 60 }, false)!.axis).toBe('radial')
  })
})

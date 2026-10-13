import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { usePinchPan } from './usePinchPan'

function setup(zoom = 1) {
  const el = document.createElement('div')
  document.body.append(el)
  const state = { zoom }
  const setZoom = vi.fn((v: number) => {
    state.zoom = v
  })
  const panBy = vi.fn()
  const cancelStroke = vi.fn()
  effectScope().run(() => usePinchPan(ref(el), { zoom: () => state.zoom, setZoom, panBy, cancelStroke }))

  const heard: string[] = []
  const child = document.createElement('div')
  el.append(child)
  for (const type of ['pointerdown', 'pointermove']) child.addEventListener(type, () => heard.push(type))

  function fire(type: string, id: number, x: number, y: number, pointerType = 'touch') {
    const e = new Event(type, { bubbles: true }) as PointerEvent
    Object.assign(e, { pointerId: id, clientX: x, clientY: y, pointerType })
    child.dispatchEvent(e)
  }
  return { state, setZoom, panBy, cancelStroke, heard, fire }
}

describe('usePinchPan', () => {
  it('leaves a one-finger stroke to the surface', () => {
    const t = setup()
    t.fire('pointerdown', 1, 10, 10)
    t.fire('pointermove', 1, 20, 10)
    expect(t.heard).toEqual(['pointerdown', 'pointermove'])
    expect(t.cancelStroke).not.toHaveBeenCalled()
  })

  it('cancels the stroke when a second finger lands, and mutes the surface until all are up', () => {
    const t = setup()
    t.fire('pointerdown', 1, 10, 10)
    t.fire('pointerdown', 2, 110, 10)
    expect(t.cancelStroke).toHaveBeenCalledOnce()
    t.fire('pointermove', 1, 0, 10)
    t.fire('pointerup', 2, 110, 10)
    t.fire('pointermove', 1, 5, 10)
    expect(t.heard).toEqual(['pointerdown'])
    t.fire('pointerup', 1, 5, 10)
    t.fire('pointerdown', 3, 5, 5)
    expect(t.heard).toEqual(['pointerdown', 'pointerdown'])
  })

  it('zooms with the spread of the fingers', () => {
    const t = setup(1)
    t.fire('pointerdown', 1, 0, 0)
    t.fire('pointerdown', 2, 100, 0)
    t.fire('pointermove', 2, 200, 0)
    expect(t.state.zoom).toBeCloseTo(2)
  })

  it('zooms about the point between the fingers and moves the canvas with them', () => {
    const t = setup(1)
    t.fire('pointerdown', 1, 0, 0)
    t.fire('pointerdown', 2, 100, 0)
    t.fire('pointermove', 2, 200, 20)
    expect(t.setZoom).toHaveBeenLastCalledWith(expect.closeTo(2, 1), { x: 100, y: 10 })
    expect(t.panBy).toHaveBeenLastCalledWith(50, 10)
  })

  it('ignores a mouse and a pen', () => {
    const t = setup()
    t.fire('pointerdown', 1, 0, 0, 'mouse')
    t.fire('pointerdown', 2, 100, 0, 'pen')
    expect(t.cancelStroke).not.toHaveBeenCalled()
    expect(t.heard).toEqual(['pointerdown', 'pointerdown'])
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTableWheel } from './useTableWheel'

const wheel = (init: WheelEventInit = {}) => new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init })

/** A layer over the Table holding a part of the margin sheet and a list that scrolls. */
function mountLayer(surface: { wheel: (event: WheelEvent) => void } | undefined) {
  const layer = document.createElement('div')
  layer.innerHTML = '<span id="legend"></span><div id="list" style="overflow-y: auto"><span id="row"></span></div>'
  document.body.append(layer)
  const list = layer.querySelector('#list')!
  Object.defineProperties(list, { scrollHeight: { value: 200 }, clientHeight: { value: 100 } })
  layer.addEventListener('wheel', useTableWheel(() => surface))
  return (id: string) => layer.querySelector(`#${id}`)!
}

describe('useTableWheel', () => {
  afterEach(() => document.body.replaceChildren())

  it('hands a wheel over the sheet to the surface, zoom and scroll alike', () => {
    const surface = { wheel: vi.fn() }
    const at = mountLayer(surface)
    at('legend').dispatchEvent(wheel({ ctrlKey: true }))
    at('legend').dispatchEvent(wheel())
    expect(surface.wheel).toHaveBeenCalledTimes(2)
  })

  it('leaves a plain wheel to a list that scrolls, but still zooms over it', () => {
    const surface = { wheel: vi.fn() }
    const at = mountLayer(surface)
    at('row').dispatchEvent(wheel())
    expect(surface.wheel).not.toHaveBeenCalled()
    at('row').dispatchEvent(wheel({ metaKey: true }))
    expect(surface.wheel).toHaveBeenCalledOnce()
  })

  it('leaves a wheel something else already took', () => {
    const surface = { wheel: vi.fn() }
    const at = mountLayer(surface)
    at('legend').addEventListener('wheel', (event) => event.preventDefault())
    at('legend').dispatchEvent(wheel({ ctrlKey: true }))
    expect(surface.wheel).not.toHaveBeenCalled()
  })

  it('does nothing with no surface', () => {
    const at = mountLayer(undefined)
    const event = wheel()
    at('legend').dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

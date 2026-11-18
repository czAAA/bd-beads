import { describe, expect, it } from 'vitest'
import { cssZoomOf, ownLength, ownPoint, pixelRatioOf } from './cssZoom'

// On-screen px into an element's own under CSS `zoom` (ticket 1071): the Homepage draws its demo larger with it, and the
// Canvas reads the pointer and its own size on screen but places its sheets and bars in its own px.

/** An element drawn at `zoom`, whose box starts at (left, top) on screen. */
function drawnAt(zoom: number | undefined, left = 0, top = 0): HTMLElement {
  const element = document.createElement('div')
  if (zoom !== undefined) Object.defineProperty(element, 'currentCSSZoom', { value: zoom })
  element.getBoundingClientRect = () => new DOMRect(left, top, 300, 200)
  return element
}

describe('cssZoomOf', () => {
  it('is the zoom the element is drawn at', () => {
    expect(cssZoomOf(drawnAt(1.5))).toBe(1.5)
  })

  it('is 1 where the browser has no zoom to tell, or there is no element', () => {
    expect(cssZoomOf(drawnAt(undefined))).toBe(1)
    expect(cssZoomOf(drawnAt(0))).toBe(1)
    expect(cssZoomOf(undefined)).toBe(1)
  })
})

describe('ownPoint', () => {
  it("is a client point's place from the element's corner in its own px", () => {
    expect(ownPoint(drawnAt(1.5, 100, 40), { clientX: 400, clientY: 340 })).toEqual({ x: 200, y: 200 })
  })

  it('is the place on screen at zoom 1, as the editor is drawn', () => {
    expect(ownPoint(drawnAt(1, 100, 40), { clientX: 400, clientY: 340 })).toEqual({ x: 300, y: 300 })
  })
})

describe('ownLength', () => {
  it('is a length on screen in the own px of an element drawn at a zoom: a drag of 30 at 1.5 moves 20', () => {
    expect(ownLength(drawnAt(1.5), 30)).toBe(20)
  })
})

describe('pixelRatioOf', () => {
  it("is the device's pixels to one of the element's own: a canvas drawn larger stays sharp", () => {
    const was = window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    try {
      expect(pixelRatioOf(drawnAt(1.5))).toBe(3)
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: was, configurable: true })
    }
  })
})

import { vi } from 'vitest'

/**
 * jsdom has no layout, so an element's box is whatever a test says. The surface's is the size its own style states, at
 * the page's corner, which is all that turning a bead's place into a pointer's place needs. Every other element keeps
 * jsdom's own answer.
 */
export function installSurfaceLayout(): void {
  const original = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('pattern-surface')) {
      const style = (this as HTMLElement).style
      const width = Number.parseFloat(style.width)
      const height = Number.parseFloat(style.height)
      return { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    }
    return original.call(this)
  })
}

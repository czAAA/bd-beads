import { vi } from 'vitest'

/** jsdom has no layout: the surface's box is the size its own style states, at the page's corner, which is all that
 * turning a bead's place into a pointer's place needs. Every other element keeps jsdom's own answer. */
/** jsdom's own method, taken once at module load: installing runs before every test, and reading the prototype then
 * would pick up the previous test's spy, whose "original" is itself, and recurse. */
const original = typeof Element === 'undefined' ? undefined : Element.prototype.getBoundingClientRect

export function installSurfaceLayout(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('project-surface')) {
      const style = (this as HTMLElement).style
      const width = Number.parseFloat(style.width)
      const height = Number.parseFloat(style.height)
      return { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    }
    return original!.call(this)
  })
}

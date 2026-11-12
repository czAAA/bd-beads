// What's inside's demo is only to watch (Homepage card, ticket 0879): its box is inert, so a beader's press, hover or key
// does nothing in it, nothing in it takes the focus, and assistive tech meets none of it, but for the page's own Expand.
// The ghost's hand still works it: its presses are the controls' own clicks, which inert leaves be.

const INERT = 'inert'

/** Makes everything in `root` inert but the element `kept` names and the boxes it lies in, and keeps it so as the box's
 * insides change (a panel the ghost opens, a fresh demo, Expand coming and going); gives back the way to stop. */
export function watchOnly(root: HTMLElement, kept: string): () => void {
  function seal(): void {
    const keep = root.querySelector(kept)
    const path = new Set<Element>()
    for (let up = keep; up && up !== root; up = up.parentElement) path.add(up)
    const walk = (parent: Element): void => {
      for (const child of parent.children) {
        if (!path.has(child)) {
          if (!child.hasAttribute(INERT)) child.setAttribute(INERT, '')
          continue
        }
        if (child.hasAttribute(INERT)) child.removeAttribute(INERT)
        if (child !== keep) walk(child)
      }
    }
    walk(root)
  }
  seal()
  // Setting `inert` is no change of children, so the observer never wakes itself.
  const observer = new MutationObserver(seal)
  observer.observe(root, { childList: true, subtree: true })
  return () => observer.disconnect()
}

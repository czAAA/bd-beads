/** A length token as the page resolves it, in px, measured in `within` so a scoped value counts (ticket 0827). */
export function tokenPx(within: Element, token: string): number {
  const probe = document.createElement('span')
  probe.style.cssText = `position: absolute; height: var(${token})`
  within.append(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height
}

/** What the hover text check measures in the page (tickets 264, 552). */

/** Measures the open bubble of the trigger marked `data-hover-probe=index`, in the page (the browser tests send it there, so it stays
 * self-contained). Null when none is open. */
export function measureOpenBubble(index: number): { text: string; owner: string; cuts: { against: string; pixels: number }[] } | null {
  const TOLERANCE = 1
  const wrapper = document.querySelector(`[data-hover-probe="${index}"]`)
  const bubble = wrapper?.querySelector<HTMLElement>('[data-testid="tooltip"]')
  if (!bubble || getComputedStyle(bubble).display === 'none') return null
  const describe = (element: Element): string => {
    const id = element.getAttribute('data-testid')
    const classes = [...element.classList].slice(0, 2).join('.')
    return `${element.tagName.toLowerCase()}${id ? `[${id}]` : ''}${classes ? `.${classes}` : ''}`
  }
  const round = (value: number) => Math.round(value * 10) / 10
  const text = (bubble.textContent ?? '').replace(/\s+/g, ' ').trim()
  const box = bubble.getBoundingClientRect()
  const cuts: { against: string; pixels: number }[] = []
  const SIDE_NAMES = ['left', 'right', 'top', 'bottom']
  const sides = (clip: { left: number; right: number; top: number; bottom: number }, rect: { left: number; right: number; top: number; bottom: number }) => [clip.left - rect.left, rect.right - clip.right, clip.top - rect.top, rect.bottom - clip.bottom]

  // Past the screen's edge.
  const edges = sides({ left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }, box)
  const past = Math.max(...edges)
  if (past > TOLERANCE) cuts.push({ against: `the viewport's ${SIDE_NAMES[edges.indexOf(past)]} edge`, pixels: round(past) })

  // Past an ancestor that clips it, as the text fit check reads clipping: a fixed element is clipped by none of its
  // ancestors, an absolute one only by those at or above its containing block. Unlike text in a scrolling column, a
  // bubble cut at the column's edge is cut for whoever is looking at it, so all four sides count.
  let skipUnpositioned = false
  for (let ancestor: Element | null = bubble; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    if (style.position === 'fixed') break
    const containing = style.position !== 'static' || style.transform !== 'none'
    const considered = ancestor === bubble ? false : !skipUnpositioned || containing
    if (containing) skipUnpositioned = false
    if (style.position === 'absolute') skipUnpositioned = true
    const clipsX = style.overflowX !== 'visible'
    const clipsY = style.overflowY !== 'visible'
    if (!considered || (!clipsX && !clipsY)) continue
    const rect = ancestor.getBoundingClientRect()
    const clip = {
      left: clipsX ? rect.left + ancestor.clientLeft : -Infinity,
      right: clipsX ? rect.left + ancestor.clientLeft + ancestor.clientWidth : Infinity,
      top: clipsY ? rect.top + ancestor.clientTop : -Infinity,
      bottom: clipsY ? rect.top + ancestor.clientTop + ancestor.clientHeight : Infinity,
    }
    const edgesOfClip = sides(clip, box)
    const worst = Math.max(...edgesOfClip)
    if (worst > TOLERANCE) cuts.push({ against: `${describe(ancestor)}'s ${SIDE_NAMES[edgesOfClip.indexOf(worst)]} edge`, pixels: round(worst) })
  }

  // Its own text against its own box: wrapping past it, an ellipsis, a child that is wider than the bubble.
  const ownPast = Math.max(bubble.scrollWidth - bubble.clientWidth, bubble.scrollHeight - bubble.clientHeight)
  if (ownPast > TOLERANCE) cuts.push({ against: 'its own box', pixels: ownPast })
  const range = document.createRange()
  const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT)
  let textPast = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue
    range.selectNodeContents(node)
    for (const rect of range.getClientRects()) textPast = Math.max(textPast, rect.right - box.right, box.left - rect.left)
  }
  if (textPast > TOLERANCE) cuts.push({ against: 'its own box', pixels: round(textPast) })
  for (const element of [bubble, ...bubble.querySelectorAll('*')]) {
    if (getComputedStyle(element).textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + TOLERANCE) cuts.push({ against: 'an ellipsis', pixels: element.scrollWidth - element.clientWidth })
  }
  return { text, owner: bubble.getAttribute('data-owner') ?? '', cuts }
}

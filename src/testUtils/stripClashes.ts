// What the strip's fit tests ask (ticket 1244): nothing in it drawn over anything else, and nothing outside it.
const PARTS = 'button, a, [data-testid="homepage-slogan"], [data-testid="canvas-brand"], [data-testid="strip-demo"]'
const SCROLLER = '[data-testid="canvas-strip-scroller"]'
/** Rounding, and the dividers' flush fit. */
const SLACK = 0.5

interface Part { el: Element; name: string; left: number; right: number; top: number; bottom: number }

/** A part as it is seen: one in the scrolling row only as far as the row shows it. */
function seen(el: Element): Part {
  const { left, right, top, bottom } = el.getBoundingClientRect()
  const row = el.closest(SCROLLER)?.getBoundingClientRect()
  const name = el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.textContent!.trim()
  return { el, name, left: row ? Math.max(left, row.left) : left, right: row ? Math.min(right, row.right) : right, top, bottom }
}

/** Every pair of the strip's parts that overlap and every part outside the strip, by name: [] is a pass. */
export function stripClashes(strip: Element): string[] {
  const box = strip.getBoundingClientRect()
  const parts = [...strip.querySelectorAll(PARTS)]
    .filter((el) => getComputedStyle(el).visibility !== 'hidden')
    .map(seen)
    .filter((part) => part.right - part.left > 1 && part.bottom - part.top > 1)
  const outside = parts
    .filter((p) => p.left < box.left - SLACK || p.right > box.right + SLACK || p.top < box.top - SLACK || p.bottom > box.bottom + SLACK)
    .map((p) => `${p.name} outside the strip`)
  const over = parts.flatMap((a, i) =>
    parts
      .slice(i + 1)
      .filter((b) => !a.el.contains(b.el) && !b.el.contains(a.el))
      .filter((b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > SLACK && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > SLACK)
      .map((b) => `${a.name} over ${b.name}`),
  )
  return [...outside, ...over]
}

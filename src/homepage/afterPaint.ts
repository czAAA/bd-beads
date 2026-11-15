/** Runs `then` once the page has shown its first text (ticket 0991): at its first contentful paint, which the browser
 * reports once that frame is on screen, or after the next frame where it reports none. What waits here never holds up
 * the first screen. */
export function afterPaint(then: () => void): void {
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes.includes('paint')) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(then))
    else setTimeout(then)
    return
  }
  const observer = new PerformanceObserver((entries) => {
    if (entries.getEntriesByName('first-contentful-paint').length === 0) return
    observer.disconnect()
    setTimeout(then)
  })
  // Buffered: the paint may have come before this page's code asked.
  observer.observe({ type: 'paint', buffered: true })
}

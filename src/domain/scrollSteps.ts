/** Where a pane's scroll stands each step at the top (ConvertImage card, Steps; ticket 0780): a step's own top, held to
 * the most the pane scrolls. The steps too short to reach the top share the last stretch of scroll out evenly, so each
 * still becomes current in turn. `tops` are the steps' tops in the pane, in order. */
export function stepAnchors(tops: readonly number[], maxScroll: number): number[] {
  const max = Math.max(0, maxScroll)
  const anchors = tops.map((top) => Math.min(top, max))
  const firstOut = anchors.findIndex((anchor, index) => index > 0 && anchor >= max && (tops[index] ?? 0) > max)
  if (firstOut <= 0) return anchors
  const from = anchors[firstOut - 1]!
  const shared = anchors.length - firstOut
  for (let index = firstOut; index < anchors.length; index += 1) anchors[index] = from + ((max - from) * (index - firstOut + 1)) / shared
  return anchors
}

/** The scroll's place in steps (1.25 is a quarter of the way from the second step to the third), from the anchors of
 * `stepAnchors`: what the Progress bar's fill and spark follow. */
export function scrollPosition(anchors: readonly number[], scrollTop: number): number {
  const last = anchors.length - 1
  if (last <= 0 || scrollTop <= anchors[0]!) return 0
  for (let index = 0; index < last; index += 1) {
    const from = anchors[index]!
    const to = anchors[index + 1]!
    if (scrollTop < to) return index + (scrollTop - from) / Math.max(1, to - from)
  }
  return last
}

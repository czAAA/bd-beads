// Measuring where a control answers a press in a real browser (ticket 0962): the hit area is what `elementFromPoint`
// finds, a pad (`::before`) included. Only for `*.browser.test.ts`.
import { expect } from 'vitest'

/** Fails unless the page is a touch screen: a test of touch hit areas runs in the `browser-touch` project, named
 * `*.touch.browser.test.ts`, whose page has Playwright's `hasTouch` (vite.config.ts). */
export function expectTouchScreen(): void {
  expect(matchMedia('(pointer: coarse)').matches, 'a *.touch.browser.test.ts runs on a touch screen').toBe(true)
}

const answers = (control: Element, x: number, y: number) => {
  const hit = document.elementFromPoint(x, y)
  return !!hit && control.contains(hit)
}

/** How far the control answers from its centre, along one axis, out to `limit` px each way. */
function reach(control: Element, from: { x: number; y: number }, step: { x: number; y: number }, limit: number): number {
  let reached = 0
  for (let distance = 1; distance <= limit; distance += 1) {
    if (!answers(control, from.x + step.x * distance, from.y + step.y * distance)) break
    reached = distance
  }
  return reached
}

/** The controls under `root` with these test ids, by test id; every one there. */
export function byTestid(root: Element, testids: string[]): Record<string, Element> {
  return Object.fromEntries(
    testids.map((testid) => {
      const control = root.querySelector(`[data-testid="${testid}"]`)
      expect(control, testid).not.toBeNull()
      return [testid, control!]
    }),
  )
}

/** How far past a control's own drawing a scan looks, as a share of the size asked for. */
const SCAN_REACH = 2
/** How far in from a drawn corner a point is taken as the control's own. */
const CORNER_INSET_PX = 2

/** How far in from its box's corner a control with corners rounded by `radius` px is still drawn: where the round
 * corner crosses the box's diagonal, and a pixel more. For `hitAreaProblems` on round tiles (ticket 1064). */
export function roundCornerInset(radius: number): number {
  return Math.ceil(radius * (1 - Math.SQRT1_2)) + 1
}

/** What is wrong with each control's hit area, by its name: it answers across less than `least` px wide or tall
 * through its centre, or a point of its own drawing answers to another of `controls` (a neighbour's pad lies over
 * it). `cornerInset` is how far in from its box's corners a control is drawn, for round ones. Empty is a pass. */
export function hitAreaProblems(controls: Record<string, Element>, least: number, cornerInset: number = CORNER_INSET_PX): string[] {
  const problems: string[] = []
  const all = Object.entries(controls)
  for (const [name, control] of all) {
    const box = control.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) {
      problems.push(`${name} is not drawn`)
      continue
    }
    const centre = { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
    if (!answers(control, centre.x, centre.y)) {
      problems.push(`${name} does not answer at its centre`)
      continue
    }
    const limit = least * SCAN_REACH
    const wide = reach(control, centre, { x: -1, y: 0 }, limit) + reach(control, centre, { x: 1, y: 0 }, limit) + 1
    const high = reach(control, centre, { x: 0, y: -1 }, limit) + reach(control, centre, { x: 0, y: 1 }, limit) + 1
    // A pixel's rounding either side: the drawn edges are fractional.
    if (wide < least - 1) problems.push(`${name} answers ${wide}px wide`)
    if (high < least - 1) problems.push(`${name} answers ${high}px tall`)
    const inset = cornerInset
    for (const [x, y] of [[box.left + inset, box.top + inset], [box.right - inset, box.top + inset], [box.left + inset, box.bottom - inset], [box.right - inset, box.bottom - inset]]) {
      const other = all.find(([otherName, each]) => otherName !== name && answers(each, x, y))
      if (other) problems.push(`${other[0]} answers over ${name} at ${Math.round(x)}, ${Math.round(y)}`)
    }
  }
  return problems
}

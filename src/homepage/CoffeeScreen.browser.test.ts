import { describe, expect, it } from 'vitest'
import { mountAt } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'

// Only the cup and Buy me a coffee take a click in the band (ticket 0813); the title, the text, the promises and the
// band's space don't. View the source is in the Open source tile (ticket 0823).
const middle = (element: Element) => {
  const box = element.getBoundingClientRect()
  return [box.left + box.width / 2, box.top + box.height / 2] as const
}
const linkAt = ([x, y]: readonly [number, number]) => document.elementFromPoint(x, y)?.closest('a, button') ?? null

/** The Homepage turned to the coffee screen: its layout answers to the box's width (the `homepage` container). */
async function coffeeAt(width: number): Promise<Element> {
  const { root } = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width })
  root.querySelectorAll<HTMLElement>('[data-testid="section-step"]')[1]!.click()
  await settleForMeasuring()
  return root.querySelector('[data-testid="homepage-coffee"]')!
}

describe('CoffeeScreen, clicked', () => {
  for (const width of [1280, 390]) {
    it(`opens the Coffee link from the cup and the button, and nothing elsewhere in the band, at ${width}px`, async () => {
      const root = await coffeeAt(width)
      const button = root.querySelector('[data-testid="homepage-coffee-button"]')!
      const cupLink = root.querySelector('[data-testid="homepage-coffee-cup-link"]')!
      const cup = root.querySelector('[data-testid="coffee-cup"]')!
      expect(cup.getBoundingClientRect().width).toBeGreaterThanOrEqual(64)
      expect(linkAt(middle(cup))).toBe(cupLink)
      expect(cupLink.getAttribute('href')).toBe(button.getAttribute('href'))
      expect(linkAt(middle(button))).toBe(button)
      const band = root.querySelector('[data-testid="homepage-coffee-band"]')!.getBoundingClientRect()
      const dead = [
        middle(root.querySelector('.coffee__title')!),
        middle(root.querySelector('.coffee__text')!),
        middle(root.querySelector('[data-testid="homepage-promise-offline"]')!),
        [band.left + 12, band.top + 12] as const,
        [band.right - 12, band.bottom - 12] as const,
      ]
      for (const point of dead) expect(linkAt(point), `the point ${point.join(', ')}`).toBeNull()
      const source = root.querySelector('[data-testid="homepage-coffee-source"]')!
      source.scrollIntoView({ block: 'center' })
      expect(linkAt(middle(source))).toBe(source)
    })
  }
})

/** How many columns the elements a selector finds stand in: their distinct left edges. */
const columns = (root: Element, selector: string) => new Set([...root.querySelectorAll(selector)].map((el) => Math.round(el.getBoundingClientRect().left))).size
/** How many rows the elements a selector finds stand in: their distinct tops. */
const rows = (root: Element, selector: string) => new Set([...root.querySelectorAll(selector)].map((el) => Math.round(el.getBoundingClientRect().top))).size
const centreOf = (box: DOMRect) => (box.left + box.right) / 2

describe('CoffeeScreen at its widths (ticket 0823)', () => {
  it('from 1000px: the cup and title beside the text, the button centred under the text, the promises in one row', async () => {
    const root = await coffeeAt(1280)
    const box = (selector: string) => root.querySelector(selector)!.getBoundingClientRect()
    const text = box('.coffee__text')
    const button = box('[data-testid="homepage-coffee-button"]')
    expect(box('[data-testid="coffee-cup"]').right, 'the cup before the title').toBeLessThanOrEqual(box('.coffee__title').left)
    expect(box('.coffee__title').right, 'the text on the right').toBeLessThanOrEqual(text.left)
    expect(button.top).toBeGreaterThanOrEqual(text.bottom)
    expect(Math.abs(centreOf(button) - centreOf(text)), 'the button centred under the text').toBeLessThanOrEqual(1)
    expect(rows(root, '[data-testid^="homepage-promise-"]'), 'the six promises in one row').toBe(1)
    expect(columns(root, '[data-testid="homepage-tiles"] > *'), 'the tiles side by side').toBe(3)
  })

  for (const width of [820, 390]) {
    it(`under 1000px at ${width}: one column, centred, the promises wrapping to centred rows`, async () => {
      const root = await coffeeAt(width)
      const box = (selector: string) => root.querySelector(selector)!.getBoundingClientRect()
      const centre = centreOf(box('[data-testid="homepage-coffee-band"]'))
      expect(box('.coffee__text').top, 'the text under the cup and title').toBeGreaterThanOrEqual(box('.coffee__lead').bottom)
      for (const selector of ['.coffee__lead', '.coffee__text', '[data-testid="homepage-coffee-button"]']) {
        expect(Math.abs(centreOf(box(selector)) - centre), `${selector} centred`).toBeLessThanOrEqual(1)
      }
      const promises = [...root.querySelectorAll('[data-testid^="homepage-promise-"]')].map((el) => el.getBoundingClientRect())
      const tops = new Set(promises.map((promise) => Math.round(promise.top)))
      expect(tops.size, 'the promises wrap').toBeGreaterThan(1)
      for (const top of tops) {
        const row = promises.filter((promise) => Math.round(promise.top) === top)
        expect(Math.abs((row[0].left + row.at(-1)!.right) / 2 - centre), 'a row of promises centred').toBeLessThanOrEqual(1)
      }
      expect(columns(root, '[data-testid="homepage-tiles"] > *')).toBe(width > 480 ? 3 : 1)
    })
  }
})

describe("What's new at its widths (ticket 0824)", () => {
  for (const width of [1280, 820, 390]) {
    it(`at ${width}: the first tile, its dates in one column, each line beside its date, Every change a link`, async () => {
      const root = await coffeeAt(width)
      const tiles = [...root.querySelectorAll('[data-testid="homepage-tiles"] > *')]
      expect(tiles[0]?.getAttribute('data-testid')).toBe('homepage-tile-whats-new')
      const notes = [...root.querySelectorAll('[data-testid="homepage-release-note"]')]
      expect(notes).toHaveLength(3)
      const dates = notes.map((note) => note.querySelector('time')!.getBoundingClientRect())
      const lines = notes.map((note) => note.querySelector('.whats-new__line')!.getBoundingClientRect())
      expect(new Set(lines.map((line) => Math.round(line.left))).size, 'the lines start in one column').toBe(1)
      for (const [i, date] of dates.entries()) {
        expect(date.right, `note ${i + 1}'s line beside its date`).toBeLessThanOrEqual(lines[i].left)
        expect(Math.abs(date.left - dates[0].left), 'the dates in one column').toBeLessThanOrEqual(1)
      }
      const history = root.querySelector('[data-testid="homepage-history"]')!
      history.scrollIntoView({ block: 'center' })
      expect(linkAt(middle(history))).toBe(history)
      expect(getComputedStyle(history).textDecorationLine, 'underlined at rest').toBe('underline')
    })
  }
})

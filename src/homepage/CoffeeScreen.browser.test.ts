import { afterEach, describe, expect, it } from 'vitest'
import { FIT_LOCALES, misfitsNow, mountAt, type FitLocale } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { turnToSection } from '../testUtils/homepageSection'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import { tokenPx } from '../testUtils/tokenPx'
import HomePage from './HomePage.vue'

// Only the cup and Buy me a coffee take a click in the band's story (ticket 0813); the title, the text and the band's
// space don't. View the source stands beside Open source (ticket 0948), on a phone in its row.
const middle = (element: Element) => {
  const box = element.getBoundingClientRect()
  return [box.left + box.width / 2, box.top + box.height / 2] as const
}
const linkAt = ([x, y]: readonly [number, number]) => document.elementFromPoint(x, y)?.closest('a, button') ?? null

/** The Homepage turned to the coffee screen: its layout answers to the box's width (the `homepage` container). */
async function coffeeAt(width: number, locale: FitLocale = 'en'): Promise<Element> {
  const { root } = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale, width })
  await turnToSection(root, 'coffee')
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

/** How many rows the elements a selector finds stand in: their distinct tops. */
const rows = (root: Element, selector: string) => new Set([...root.querySelectorAll(selector)].map((el) => Math.round(el.getBoundingClientRect().top))).size
const centreOf = (box: DOMRect) => (box.left + box.right) / 2

describe('CoffeeScreen at its widths (ticket 0823)', () => {
  it('from 1000px: the cup and title beside the text, the button centred under the text, the promises in two rows', async () => {
    const root = await coffeeAt(1280)
    const box = (selector: string) => root.querySelector(selector)!.getBoundingClientRect()
    const text = box('.coffee__text')
    const button = box('[data-testid="homepage-coffee-button"]')
    expect(box('[data-testid="coffee-cup"]').right, 'the cup before the title').toBeLessThanOrEqual(box('.coffee__title').left)
    expect(box('.coffee__title').right, 'the text on the right').toBeLessThanOrEqual(text.left)
    expect(button.top).toBeGreaterThanOrEqual(text.bottom)
    expect(Math.abs(centreOf(button) - centreOf(text)), 'the button centred under the text').toBeLessThanOrEqual(1)
    expect(rows(root, '[data-testid^="homepage-coffee-promise-"]'), 'the six promises in two rows').toBe(2)
  })

  // On a phone the promises are a grouped list under the band (ticket 0827), laid out in homepagePhone.browser.test.ts.
  for (const width of [820, 500]) {
    it(`under 1000px at ${width}: one column, centred, the promises centred`, async () => {
      const root = await coffeeAt(width)
      const box = (selector: string) => root.querySelector(selector)!.getBoundingClientRect()
      const centre = centreOf(box('[data-testid="homepage-coffee-band"]'))
      expect(box('.coffee__text').top, 'the text under the cup and title').toBeGreaterThanOrEqual(box('.coffee__lead').bottom)
      for (const selector of ['.coffee__lead', '.coffee__text', '[data-testid="homepage-coffee-button"]']) {
        expect(Math.abs(centreOf(box(selector)) - centre), `${selector} centred`).toBeLessThanOrEqual(1)
      }
      expect(rows(root, '[data-testid^="homepage-coffee-promise-"]'), 'the promises in two rows, three under 640').toBe(width < 640 ? 3 : 2)
      for (const selector of ['[data-testid="homepage-coffee-promises"]', '[data-testid="homepage-coffee-acts"]']) {
        expect(Math.abs(centreOf(box(selector)) - centre), `${selector} centred`).toBeLessThanOrEqual(1)
      }
    })
  }
})

describe("What's new at its widths (tickets 0824, 0880)", () => {
  for (const width of [1280, 820, 390]) {
    it(`at ${width}: as wide as the band, under it; open, its dates in one column, each line beside its date, Every change a link`, async () => {
      const root = await coffeeAt(width)
      const fold = root.querySelector('[data-testid="homepage-whats-new"]')!.getBoundingClientRect()
      const band = root.querySelector('[data-testid="homepage-coffee-band"]')!.getBoundingClientRect()
      expect(fold.width, 'as wide as the band').toBeCloseTo(band.width, 0)
      expect(fold.top).toBeGreaterThan(band.bottom)
      const head = root.querySelector<HTMLElement>('[data-testid="homepage-whats-new-toggle"]')!
      expect(head.getBoundingClientRect().height, 'a hit target').toBeGreaterThanOrEqual(tokenPx(head, '--touch-target') - 0.5)
      head.click()
      await settleForMeasuring()
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

const ZOOM_KEY = 'openbeads:homepage-zoom'
afterEach(() => localStorage.removeItem(ZOOM_KEY))

// Every promise's name is in view at once (ticket 0948): two rows of three (three of two in a box under 640), Open
// source and Say hello under them with their controls, nothing over anything else, nothing past the band and no
// sideways scroll, at every width from 481 and every zoom (a zoom is a narrower layout), in the longest language too.
describe('The promises, every name in view (ticket 0948)', () => {
  const cases = [
    [1366, 100],
    [1280, 100],
    [1024, 100],
    [820, 100],
    [500, 100],
    [1024, 200],
    [1280, 75],
  ] as const
  const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
  for (const locale of FIT_LOCALES) {
    for (const [width, zoom] of cases) {
      it(`${locale} at ${width}px, ${zoom}%`, async () => {
        localStorage.setItem(ZOOM_KEY, String(zoom))
        const root = await coffeeAt(width, locale)
        await settleForMeasuring()
        const section = root.closest<HTMLElement>('[data-testid="homepage-section-coffee"]')!
        const band = root.querySelector('[data-testid="homepage-coffee-band"]')!.getBoundingClientRect()
        // Two rows of three; three rows of two in a box under 640 (500px, or 1024px at 200%).
        const narrow = width / (zoom / 100) < 640
        expect(rows(root, '[data-testid^="homepage-coffee-promise-"]'), 'the rows of promises').toBe(narrow ? 3 : 2)
        const items = [...root.querySelectorAll('[data-testid^="homepage-coffee-promise-"], [data-testid^="homepage-coffee-act-"]')]
        expect(items).toHaveLength(8)
        const boxes = items.map((item) => item.getBoundingClientRect())
        for (const [i, item] of items.entries()) {
          const id = item.getAttribute('data-testid')
          const name = item.querySelector('.coffee-promise__name')!
          expect(name.getBoundingClientRect().width, `${id}'s name shown`).toBeGreaterThan(0)
          expect(boxes[i]!.left >= band.left && boxes[i]!.right <= band.right, `${id} within the band`).toBe(true)
          for (const [j, other] of boxes.entries()) if (j > i) expect(overlap(boxes[i]!, other), `${id} clear of ${items[j]!.getAttribute('data-testid')}`).toBe(false)
        }
        for (const action of root.querySelectorAll('.coffee-promise__action')) {
          action.scrollIntoView({ block: 'nearest' })
          expect(linkAt(middle(action)), `${action.textContent} takes its click`).toBe(action)
        }
        expect(section.scrollWidth, 'no sideways scroll').toBeLessThanOrEqual(section.clientWidth)
        // The fit checks measure an unzoomed page: a zoom is a narrower layout, which 500px tries.
        if (zoom === 100) expect((await misfitsNow()).filter((misfit) => misfit.includes('coffee')), 'nothing of the promises cut off').toEqual([])
      })
    }
  }
})

// On a phone, Open source's and Say hello's actions keep to their rows (ticket 0880), on the narrowest under the whole
// row: "Ver el código fuente" is wider than the words beside the icon tile at 320.
describe("A phone's actions", () => {
  for (const locale of FIT_LOCALES) {
    for (const width of [390, 320]) {
      it(`keep to their rows, ${locale} at ${width}px`, async () => {
        const root = await coffeeAt(width, locale)
        const actions = [...root.querySelectorAll('[data-testid="homepage-promises"] .grouped-list__action > *')]
        expect(actions).toHaveLength(2)
        for (const action of actions) {
          const row = action.closest('li')!
          const inside = row.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(row).paddingRight)
          expect(action.getBoundingClientRect().right, `${action.textContent} within its row`).toBeLessThanOrEqual(inside + 0.5)
        }
      })
    }
  }
})

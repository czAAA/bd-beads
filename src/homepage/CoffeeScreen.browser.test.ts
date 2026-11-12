import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { FIT_LOCALES, misfitsNow, mountAt, resizeTo, type FitLocale } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { turnToSection } from '../testUtils/homepageSection'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import { tokenPx } from '../testUtils/tokenPx'
import HomePage from './HomePage.vue'

// Only the cup and Buy me a coffee take a click in the band's story (ticket 0813); the title, the text and the band's
// space don't. View the source is in the Open source chip (ticket 0880), on a phone in its row.
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
      if (width > 480) root.querySelector<HTMLElement>('[data-testid="homepage-chip-openSource"] button')!.click()
      await settleForMeasuring()
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
  it('from 1000px: the cup and title beside the text, the button centred under the text, the chips in one row', async () => {
    const root = await coffeeAt(1280)
    const box = (selector: string) => root.querySelector(selector)!.getBoundingClientRect()
    const text = box('.coffee__text')
    const button = box('[data-testid="homepage-coffee-button"]')
    expect(box('[data-testid="coffee-cup"]').right, 'the cup before the title').toBeLessThanOrEqual(box('.coffee__title').left)
    expect(box('.coffee__title').right, 'the text on the right').toBeLessThanOrEqual(text.left)
    expect(button.top).toBeGreaterThanOrEqual(text.bottom)
    expect(Math.abs(centreOf(button) - centreOf(text)), 'the button centred under the text').toBeLessThanOrEqual(1)
    expect(rows(root, '[data-testid^="homepage-chip-"]'), 'the eight chips in one row').toBe(1)
  })

  // On a phone the chips are a grouped list under the band (ticket 0827), laid out in homepagePhone.browser.test.ts.
  for (const width of [820, 500]) {
    it(`under 1000px at ${width}: one column, centred, the chips in one centred row`, async () => {
      const root = await coffeeAt(width)
      const box = (selector: string) => root.querySelector(selector)!.getBoundingClientRect()
      const centre = centreOf(box('[data-testid="homepage-coffee-band"]'))
      expect(box('.coffee__text').top, 'the text under the cup and title').toBeGreaterThanOrEqual(box('.coffee__lead').bottom)
      for (const selector of ['.coffee__lead', '.coffee__text', '[data-testid="homepage-coffee-button"]']) {
        expect(Math.abs(centreOf(box(selector)) - centre), `${selector} centred`).toBeLessThanOrEqual(1)
      }
      const chips = [...root.querySelectorAll('[data-testid^="homepage-chip-"]')].map((chip) => chip.getBoundingClientRect())
      expect(rows(root, '[data-testid^="homepage-chip-"]'), 'the chips in one row').toBe(1)
      expect(Math.abs((chips[0]!.left + chips.at(-1)!.right) / 2 - centre), 'the row centred').toBeLessThanOrEqual(1)
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

// An open chip rises over its neighbours toward the side with room (ticket 0880): the row never moves, no chip leaves
// it and the section never scrolls sideways, at every width from 481 and every zoom (a zoom is a narrower layout), in
// the longest language too.
describe('The chips, opened one by one (ticket 0880)', () => {
  const cases = [
    [1280, 100],
    [1024, 100],
    [820, 100],
    [500, 100],
    [1024, 200],
    [1280, 75],
  ] as const
  for (const locale of FIT_LOCALES) {
    for (const [width, zoom] of cases) {
      it(`${locale} at ${width}px, ${zoom}%`, async () => {
        localStorage.setItem(ZOOM_KEY, String(zoom))
        const root = await coffeeAt(width, locale)
        const row = root.querySelector('[data-testid="homepage-chips"]')!
        const section = root.closest<HTMLElement>('[data-testid="homepage-section-coffee"]')!
        const items = [...row.querySelectorAll<HTMLElement>(':scope > li')]
        const places = items.map((item) => item.getBoundingClientRect())
        const edge = row.getBoundingClientRect()
        expect(places[0]!.width, "the design system's least hit target").toBeCloseTo(tokenPx(row, '--touch-target'), 0)
        const found: string[] = []
        for (const [i, item] of items.entries()) {
          const id = item.getAttribute('data-chip')
          item.querySelector('button')!.click()
          await nextTick()
          await settleForMeasuring()
          expect(item.querySelector('button')!.getAttribute('aria-expanded'), `${id} open`).toBe('true')
          const face = item.querySelector('.coffee-chip__face')!.getBoundingClientRect()
          const name = item.querySelector('.coffee-chip__name')!.getBoundingClientRect()
          expect(items.map((other) => other.getBoundingClientRect().left), `${id}: no chip moves`).toEqual(places.map((place) => place.left))
          expect(face.width, `${id} opened`).toBeGreaterThan(places[i]!.width + name.width)
          expect(face.left, `${id} in the row on the left`).toBeGreaterThanOrEqual(edge.left - 0.5)
          expect(face.right, `${id} in the row on the right`).toBeLessThanOrEqual(edge.right + 0.5)
          expect(name.left >= face.left && name.right <= face.right, `${id}'s name in its chip`).toBe(true)
          // Its icon stays where it was: the chip opens from it, rightward or leftward.
          const rightward = Math.abs(face.left - places[i]!.left) < 0.5
          expect(rightward || Math.abs(face.right - places[i]!.right) < 0.5, `${id} opens from its icon`).toBe(true)
          if (i === 0) expect(rightward, 'the first chip opens rightward').toBe(true)
          // Near the right edge, with no room on the right, it opens leftward.
          if (edge.right - places[i]!.right < name.width) expect(rightward, `${id} opens leftward`).toBe(false)
          const action = item.querySelector('.coffee-chip__action')
          if (action) {
            action.scrollIntoView({ block: 'nearest' })
            expect(linkAt(middle(action)), `${id}'s action over its neighbours`).toBe(action)
          }
          expect(section.scrollWidth, 'no sideways scroll').toBeLessThanOrEqual(section.clientWidth)
          // The fit checks measure an unzoomed page: a zoom is a narrower layout, which 500px tries.
          if (zoom === 100) found.push(...(await misfitsNow()).filter((misfit) => misfit.includes('coffee')))
        }
        expect([...new Set(found)], 'nothing of the chips cut off or poking out').toEqual([])
      })
    }
  }
})

describe('An open chip, resized (ticket 0880)', () => {
  it('finds its side again when the row narrows under it', async () => {
    const root = await coffeeAt(1280, 'longest')
    const item = root.querySelector<HTMLElement>('[data-testid="homepage-chip-openSource"]')!
    item.querySelector('button')!.click()
    await settleForMeasuring()
    await resizeTo(500)
    await settleForMeasuring()
    const edge = root.querySelector('[data-testid="homepage-chips"]')!.getBoundingClientRect()
    const face = item.querySelector('.coffee-chip__face')!.getBoundingClientRect()
    expect(item.querySelector('button')!.getAttribute('aria-expanded')).toBe('true')
    expect(face.left).toBeGreaterThanOrEqual(edge.left - 0.5)
    expect(face.right).toBeLessThanOrEqual(edge.right + 0.5)
  })
})

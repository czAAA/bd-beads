import { afterEach, describe, expect, it } from 'vitest'
import { FIT_LOCALES, misfitsNow, mountAt, type FitLocale } from '../testUtils/browserFit'
import type { NotesFile, NotesFileNote } from '../domain/notesFile'
import type { AppUpdates } from '../services/offlineShell'
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

const note = (name: string, version: string, kind: NotesFileNote['kind'], line: string): NotesFileNote => ({ name, version, date: name.slice(0, 10), kind, line })
/** What's new's notes, as long as the canvas's: every kind in one block, a release between blocks (ticket 1047). */
const NOTES: NotesFile = {
  version: '2.1.2',
  releases: [{ version: '1.0.0', date: '2026-11-20' }, { version: '2.0.0', date: '2026-12-01' }],
  notes: [
    note('2026-12-04-0003', '2.1.2', 'fixed', 'На большой рамке «Ряд готов» срабатывает сразу, как и каждый шаг по полосе прогресса'),
    note('2026-12-03-0002', '2.1.1', 'changed', 'Подложка и контур детали теперь выходят на бисеринку за её крайние бусины, и там видна сетка'),
    note('2026-12-02-0001', '2.1.0', 'new', 'При увеличении штамп рамки называет её бисер, даёт кнопку «Изменить» и считает бисеринки каждого цвета'),
    note('2026-11-28-0000', '1.2.0', 'new', 'На холсте панель отражения предлагает любое число осей'),
  ],
}

/** A newer Build waiting for Reload with a note of each kind, as long as the canvas's (ticket 1049). */
const WAITING: AppUpdates = {
  onReady: (_locale, listener) => {
    listener({
      version: '2.2.1',
      notes: [
        note('2026-12-05-0006', '2.2.1', 'fixed', 'На большой рамке «Ряд готов» срабатывает сразу, как и каждый шаг по полосе прогресса'),
        note('2026-12-05-0005', '2.2.0', 'new', 'При увеличении штамп рамки называет её бисер, даёт кнопку «Изменить» и считает бисеринки'),
        note('2026-12-04-0004', '2.1.3', 'changed', 'Подложка и контур детали теперь выходят на бисеринку за её крайние бусины'),
      ],
    })
    return () => {}
  },
  apply: () => {},
}

/** The Homepage turned to the coffee screen: its layout answers to the box's width (the `homepage` container). */
async function coffeeAt(width: number, locale: FitLocale = 'en', updates?: AppUpdates): Promise<Element> {
  const { root } = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback(), notes: async () => NOTES, updates }, { locale, width })
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
/** The centre of each row the promises stand in, top to bottom: the middle of its first item's left and last's right. */
const rowCentres = (root: Element) => {
  const byTop = new Map<number, DOMRect[]>()
  for (const el of root.querySelectorAll('[data-testid^="homepage-coffee-promise-"]')) {
    const box = el.getBoundingClientRect()
    byTop.set(Math.round(box.top), [...(byTop.get(Math.round(box.top)) ?? []), box])
  }
  return [...byTop.entries()].sort(([a], [b]) => a - b).map(([, boxes]) => (Math.min(...boxes.map((b) => b.left)) + Math.max(...boxes.map((b) => b.right))) / 2)
}

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
    expect(rows(root, '[data-testid^="homepage-coffee-promise-"]'), 'the seven promises four over three').toBe(2)
    const [first, second] = rowCentres(root)
    expect(Math.abs(first! - second!), 'the three centred under the four (ticket 1175)').toBeLessThanOrEqual(1)
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
      expect(rows(root, '[data-testid^="homepage-coffee-promise-"]'), 'the promises four over three, two to a row under 640').toBe(width < 640 ? 4 : 2)
      for (const [i, rowCentre] of rowCentres(root).entries()) expect(Math.abs(rowCentre - centre), `row ${i + 1} centred`).toBeLessThanOrEqual(1)
      for (const selector of ['[data-testid="homepage-coffee-promises"]', '[data-testid="homepage-coffee-acts"]']) {
        expect(Math.abs(centreOf(box(selector)) - centre), `${selector} centred`).toBeLessThanOrEqual(1)
      }
    })
  }
})

describe("What's new at its widths (tickets 0824, 0880, 1047, 1049)", () => {
  for (const locale of FIT_LOCALES) {
    for (const width of [1280, 820, 390]) {
      it(`${locale} at ${width}: as wide as the band, under it; open, the kind labels in one column, each line beside its label, the waiting box's chip and Reload inside it, nothing cut off`, async () => {
        const root = await coffeeAt(width, locale, WAITING)
        const fold = root.querySelector('[data-testid="homepage-whats-new"]')!.getBoundingClientRect()
        const band = root.querySelector('[data-testid="homepage-coffee-band"]')!.getBoundingClientRect()
        expect(fold.width, 'as wide as the band').toBeCloseTo(band.width, 0)
        expect(fold.top).toBeGreaterThan(band.bottom)
        const head = root.querySelector<HTMLElement>('[data-testid="homepage-whats-new-toggle"]')!
        expect(head.getBoundingClientRect().height, 'a hit target').toBeGreaterThanOrEqual(tokenPx(head, '--touch-target') - 0.5)
        head.click()
        await settleForMeasuring()
        const rows = [...root.querySelectorAll('[data-testid="homepage-release-note"]')]
        expect(rows, 'the waiting box’s three, then the blocks’ four').toHaveLength(7)
        const waiting = root.querySelector('[data-testid="homepage-whats-new-waiting"]')!.getBoundingClientRect()
        expect(waiting.right, 'the box within the fold').toBeLessThanOrEqual(fold.right)
        for (const part of ['.whats-new__arrives', '[data-testid="homepage-whats-new-reload"]']) {
          const shown = root.querySelector(part)!.getBoundingClientRect()
          expect(shown.right, `${part} within the box`).toBeLessThanOrEqual(waiting.right)
          expect(shown.bottom, `${part} within the box`).toBeLessThanOrEqual(waiting.bottom)
        }
        const labels = rows.map((row) => row.querySelector('[data-testid="kind-label"]')!.getBoundingClientRect())
        const lines = rows.map((row) => row.querySelector('.whats-new__line')!.getBoundingClientRect())
        expect(new Set(lines.map((line) => Math.round(line.left))).size, 'the lines start in one column').toBe(1)
        for (const [i, label] of labels.entries()) {
          expect(label.right, `row ${i + 1}'s line beside its label`).toBeLessThanOrEqual(lines[i].left)
          expect(Math.abs(label.left - labels[0].left), 'the labels in one column').toBeLessThanOrEqual(1)
          expect(lines[i].right, `row ${i + 1} within the fold`).toBeLessThanOrEqual(fold.right)
        }
        const history = root.querySelector('[data-testid="homepage-history"]')!
        history.scrollIntoView({ block: 'center' })
        expect(linkAt(middle(history))).toBe(history)
        expect(getComputedStyle(history).textDecorationLine, 'underlined at rest').toBe('underline')
        expect((await misfitsNow()).filter((misfit) => misfit.includes('whats-new') || misfit.includes('kind-label')), 'nothing of What\'s new cut off').toEqual([])
      })
    }
  }
})

const ZOOM_KEY = 'openbeads:homepage-zoom'
afterEach(() => localStorage.removeItem(ZOOM_KEY))

// Every promise's name is in view at once (ticket 0948): four over three (ticket 1175; two to a row in a box under 640), Open
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
        // Four over three; two to a row in a box under 640 (500px, or 1024px at 200%).
        const narrow = width / (zoom / 100) < 640
        expect(rows(root, '[data-testid^="homepage-coffee-promise-"]'), 'the rows of promises').toBe(narrow ? 4 : 2)
        const items = [...root.querySelectorAll('[data-testid^="homepage-coffee-promise-"], [data-testid^="homepage-coffee-act-"]')]
        expect(items).toHaveLength(9)
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

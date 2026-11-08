import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { page } from 'vitest/browser'
import { FIT_LOCALES, misfitsNow, mountAt, type Mounted } from '../testUtils/browserFit'
import { unexplainedFit } from '../testUtils/fitPending'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'

// The Homepage on a phone (ticket 0827; Homepage card): its own bar at the box's foot, What's inside and the promises
// as grouped lists, the plans stacked, each section ending in "Next · …"; laid out and every text fit at a large and a
// small phone, in each language and for a new visitor and with Projects saved; misfits are the page's (`HomePage`).

let mounted: Mounted
afterEach(() => mounted.unmount())

const PHONES = [[390, 844], [360, 640]] as const

const el = <T extends Element = HTMLElement>(selector: string) => mounted.root.querySelector<T>(selector)!
const box = (selector: string) => el(selector).getBoundingClientRect()
const shown = () => el('.homepage__section--shown')
/** A length token as the page resolves it, in px. */
function tokenPx(token: string): number {
  const probe = document.createElement('span')
  probe.style.cssText = `position: absolute; height: var(${token})`
  mounted.root.append(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height
}

async function next() {
  el('[data-testid="phone-bar-next"]').click()
  await nextTick()
  await settleForMeasuring()
}

/** Every part of the section shown inside its width, the section scrolling no further sideways. */
function insideTheSection() {
  const section = shown()
  expect(section.scrollWidth, 'nothing wider than the section').toBeLessThanOrEqual(section.clientWidth + 1)
}

/** The section shown ends with its "Next · …" line, the last thing in it. */
function endsWithNext(heading: string) {
  const line = shown().querySelector('[data-testid="homepage-next-line"]')!
  expect(line.textContent).toContain(heading)
  const below = [...shown().children].filter((child) => child.getBoundingClientRect().top > line.getBoundingClientRect().bottom && child.getBoundingClientRect().height > 0)
  expect(below, 'nothing under the line').toEqual([])
}

describe('The Homepage on a phone (ticket 0827)', () => {
  for (const [width, height] of PHONES) {
    for (const projectCount of [0, 128]) {
      for (const locale of FIT_LOCALES) {
        it(`at ${width} × ${height}, ${projectCount ? 'with Projects saved' : 'a new visitor'}, ${locale}`, async () => {
          mounted = await mountAt(HomePage, { projectCount, feedback: fakeFeedback() }, { locale, width })
          await page.viewport(width, height)
          await settleForMeasuring()
          const found: string[] = []

          // The bar at the box's foot, in place of the Progress bar: the name, the segments and the count over ↑, the way
          // in and ↓, all three 48px tall on one line.
          expect(mounted.root.querySelector('[data-testid="section-bar"]')).toBeNull()
          const bar = box('[data-testid="phone-bar"]')
          expect(bar.bottom).toBeCloseTo(box('[data-testid="homepage"]').bottom, 0)
          expect(box('[data-testid="homepage-body"]').bottom).toBeCloseTo(bar.top, 0)
          const [back, main, down] = ['phone-bar-back', 'homepage-phone-way-in', 'phone-bar-next'].map((id) => box(`[data-testid="${id}"]`))
          const button = tokenPx('--phone-bar-button')
          for (const part of [back, main, down]) {
            expect(part.height).toBeCloseTo(button, 0)
            expect(part.top).toBeCloseTo(back.top, 0)
          }
          expect(back.width).toBeCloseTo(button, 0)
          expect(main.left).toBeGreaterThan(back.right)
          expect(down.left).toBeGreaterThan(main.right)
          const name = box('[data-testid="phone-bar-name"]')
          const track = box('[data-testid="phone-bar-track"]')
          const counter = box('[data-testid="phone-bar-counter"]')
          expect(track.left).toBeGreaterThanOrEqual(name.right)
          expect(counter.left).toBeGreaterThanOrEqual(track.right)
          expect(counter.bottom).toBeLessThanOrEqual(back.top)
          // No zoom on a phone.
          expect(box('[data-testid="zoom-reset"]').width).toBe(0)

          // What's inside: one grouped list, each row's icon tile beside its name over its line.
          insideTheSection()
          const list = box('[data-testid="inside-list"]')
          const rows = [...mounted.root.querySelectorAll('[data-testid="inside-list"] > li')]
          expect(rows).toHaveLength(13)
          for (const row of rows) {
            const tile = row.querySelector('.grouped-list__tile')!.getBoundingClientRect()
            const rowName = row.querySelector('.grouped-list__name')!.getBoundingClientRect()
            const line = row.querySelector('.grouped-list__line')!.getBoundingClientRect()
            expect(tile.width).toBeCloseTo(tokenPx('--grouped-tile'), 0)
            expect(rowName.left).toBeGreaterThanOrEqual(tile.right)
            expect(line.top).toBeGreaterThanOrEqual(rowName.bottom - 1)
            expect(line.right).toBeLessThanOrEqual(list.right)
          }
          endsWithNext(mounted.root.querySelector('[data-testid="homepage-section-coffee"]')!.getAttribute('aria-label')!)
          found.push(...(await misfitsNow()))

          // The coffee screen: the band in one column, its button the band's width and 44px tall; the promises a grouped
          // list under it, Keyboard shortcuts left out; then the tiles one under another.
          await next()
          insideTheSection()
          const band = box('[data-testid="homepage-coffee-band"]')
          const coffee = box('[data-testid="homepage-coffee-button"]')
          expect(coffee.height).toBeCloseTo(tokenPx('--touch-target'), 0)
          expect(coffee.width).toBeGreaterThan(band.width * 0.8)
          const promises = box('[data-testid="homepage-promises"]')
          expect(promises.top).toBeGreaterThanOrEqual(band.bottom)
          expect(mounted.root.querySelectorAll('[data-testid="homepage-promises"] > li')).toHaveLength(5)
          expect(mounted.root.querySelector('[data-testid="homepage-promise-shortcuts"]')).toBeNull()
          const tiles = [...mounted.root.querySelectorAll('[data-testid="homepage-tiles"] > *')].map((tile) => tile.getBoundingClientRect())
          expect(tiles[0]!.top).toBeGreaterThanOrEqual(promises.bottom)
          expect(new Set(tiles.map((tile) => Math.round(tile.left))).size, 'the tiles one under another').toBe(1)
          endsWithNext(mounted.root.querySelector('#homepage-plans')!.textContent!)
          found.push(...(await misfitsNow()))

          // The plans: No account whole with its chip and no button, the other two a row each, name over price and the
          // Coming soon chip on the right; six rows of the free list, then Show all, which opens the rest in place.
          await next()
          insideTheSection()
          expect(el('[data-testid="phone-bar-next"]').getAttribute('aria-disabled')).toBe('true')
          const plans = ['plan-no-account', 'plan-free-account', 'plan-pro'].map((id) => box(`[data-testid="${id}"]`))
          for (const [i, plan] of plans.entries()) {
            expect(plan.left).toBeCloseTo(plans[0]!.left, 0)
            expect(plan.width).toBeCloseTo(plans[0]!.width, 0)
            if (i) expect(plan.top).toBeGreaterThanOrEqual(plans[i - 1]!.bottom)
          }
          expect(mounted.root.querySelector('[data-testid="plan-no-account"] .plan__button')).toBeNull()
          expect(box('[data-testid="plan-here-chip"]').left).toBeGreaterThan(box('[data-testid="plan-no-account"] h3').left)
          for (const id of ['plan-free-account', 'plan-pro']) {
            const chip = box(`[data-testid="${id}"] [data-testid="plan-coming-soon"]`)
            const planName = box(`[data-testid="${id}"] h3`)
            expect(chip.left).toBeGreaterThanOrEqual(planName.right)
            expect(box(`[data-testid="${id}"] .plan__price`).top).toBeGreaterThanOrEqual(planName.bottom - 1)
          }
          expect(mounted.root.querySelector('.homepage__free-room')).toBeNull()
          expect(mounted.root.querySelectorAll('[data-testid="free-window"] li')).toHaveLength(6)
          const showAll = el('[data-testid="free-show-all"]')
          expect(showAll.getBoundingClientRect().top).toBeGreaterThanOrEqual(box('[data-testid="free-window"]').bottom)
          found.push(...(await misfitsNow()))
          const before = shown().scrollHeight
          showAll.click()
          await settleForMeasuring()
          expect(mounted.root.querySelectorAll('[data-testid="free-window"] li').length).toBeGreaterThan(6)
          expect(shown().scrollHeight, 'the rest opened in place').toBeGreaterThan(before)
          insideTheSection()
          found.push(...(await misfitsNow()))

          expect(unexplainedFit('HomePage', locale, width, [...new Set(found)])).toEqual([])
        }, 30000)
      }
    }
  }
})

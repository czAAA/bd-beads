import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt, unmountAll, type FitLocale } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'

afterEach(() => unmountAll())

const SHIPPED: readonly FitLocale[] = ['en', 'ru', 'uk', 'be', 'zh', 'es', 'pl']

async function welcomeAt1440(locale: FitLocale, projectCount: number): Promise<HTMLElement> {
  const mounted = await mountAt(HomePage, { projectCount, feedback: fakeFeedback() }, { locale, width: 1440 })
  await page.viewport(1440, 900)
  await settleForMeasuring()
  return mounted.root
}

/** The way in's two buttons: their sizes, and whether they stand on one row. */
function wayIn(root: HTMLElement): { sizes: string[]; oneRow: boolean } {
  const buttons = [...root.querySelectorAll<HTMLElement>('.welcome__way-in .app-button')]
  const [first, second] = buttons.map((button) => button.getBoundingClientRect())
  return {
    sizes: buttons.map((button) => (button.classList.contains('app-button--2xl') ? '2xl' : button.classList.contains('app-button--xl') ? 'xl' : 'other')),
    oneRow: Math.abs(first!.top - second!.top) <= 1,
  }
}

// The Welcome tile's way in (ticket 1130): two buttons twice as tall as `lg` where both fit on one row, a size down where
// they don't, so they always stand side by side.
describe("The Welcome tile's way in", () => {
  for (const projectCount of [0, 3]) {
    const who = projectCount ? 'with Projects' : 'a new visitor'
    for (const locale of SHIPPED) {
      it(`${locale} at 1440 × 900, ${who}: twice as tall, side by side`, async () => {
        expect(wayIn(await welcomeAt1440(locale, projectCount))).toEqual({ sizes: ['2xl', '2xl'], oneRow: true })
      })
    }

    it(`the made-up longest language at 1440 × 900, ${who}: side by side, a size down if it must`, async () => {
      const { sizes, oneRow } = wayIn(await welcomeAt1440('longest', projectCount))
      expect(oneRow).toBe(true)
      expect(sizes.every((size) => size !== 'other')).toBe(true)
    })
  }

  // The longer languages' heading and promises take more lines: the owner chose a small scroll there over a smaller piece.
  for (const locale of ['en', 'zh'] as const) {
    it(`leaves the tile whole at 1440 × 900 in ${locale}`, async () => {
      const root = await welcomeAt1440(locale, 3)
      const section = root.querySelector<HTMLElement>('[data-testid="homepage-section-welcome"]')!
      expect(section.scrollHeight).toBeLessThanOrEqual(section.clientHeight + 1)
    })
  }
})

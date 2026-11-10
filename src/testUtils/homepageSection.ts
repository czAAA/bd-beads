import { nextTick } from 'vue'
import { settleForMeasuring } from './textFitInPage'

/** Turns the mounted Homepage to a section by its id, never by its place (ticket 0830 put Welcome first): by its step on
 * the Progress bar, or on a phone by ↓ until it shows. The browser tests run under reduced motion, so it swaps without
 * sliding. Only for `*.browser.test.ts`. */
export async function turnToSection(root: Element, id: 'welcome' | 'inside' | 'coffee' | 'plans'): Promise<void> {
  const step = root.querySelector<HTMLElement>(`[data-testid="section-step"][data-step="${id}"]`)
  const shown = () => root.querySelector('.homepage__section--shown')?.getAttribute('data-testid') === `homepage-section-${id}`
  if (step) step.click()
  else {
    for (let presses = 0; presses < 3 && !shown(); presses += 1) {
      root.querySelector<HTMLElement>('[data-testid="phone-bar-next"]')!.click()
      await nextTick()
    }
  }
  await settleForMeasuring()
  if (!shown()) throw new Error(`the Homepage did not turn to ${id}`)
}

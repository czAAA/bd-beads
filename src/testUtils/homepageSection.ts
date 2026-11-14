import { nextTick } from 'vue'
import { settleForMeasuring } from './textFitInPage'

/** Turns the mounted Homepage to a section by its id, never by its place (ticket 0830 put Welcome first): by its step on
 * the Progress bar, or on a phone by ↓ until it shows. The browser tests run under reduced motion, so it swaps without
 * sliding. What's inside is turned to once its demo editor has come (ticket 0991). Only for `*.browser.test.ts`. */
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
  if (id === 'inside') await demoArrived(root)
}

/** Waits for What's inside's demo editor, which comes after the page (ticket 0991), where it has one. */
async function demoArrived(root: Element): Promise<void> {
  const started = performance.now()
  while (root.querySelector('[data-testid="inside-editor-waiting"]')) {
    if (performance.now() - started > 15_000) throw new Error("What's inside's demo editor did not come")
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  await settleForMeasuring()
}

import { expect, test, type Page } from '@playwright/test'
import { openApp, openColorPopover, openStripPanel, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The Feedback sheet (ticket 0700, FeedbackSheet card) in each Report kind, opened from its own entry point, on a phone
 * and on a wide screen. Turnstile is not loaded: its widget is invisible, and the check needs no network. */
const KINDS: readonly { kind: string; open: (page: Page) => Promise<void> }[] = [
  {
    kind: 'general',
    open: async (page) => {
      await openStripPanel(page, 'strip-menu')
      await page.getByTestId('menu-item-feedback').click()
    },
  },
  {
    kind: 'translation',
    open: async (page) => {
      await openStripPanel(page, 'strip-menu')
      await page.getByTestId('menu-report-translation').click()
    },
  },
  {
    kind: 'bead-color',
    open: async (page) => {
      await openColorPopover(page)
      await page.getByTestId('bead-colors-toggle').click()
      await page.getByTestId('bead-colors-report').click()
    },
  },
]

const SCREENS = [
  { name: 'phone', viewport: { width: 390, height: 844 } },
  { name: 'wide', viewport: { width: 1400, height: 1300 } },
] as const

for (const { kind, open } of KINDS) {
  for (const screen of SCREENS) {
    test(`Feedback sheet, ${kind}, ${screen.name}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: screen.viewport, reducedMotion: 'reduce' })
      const page = await context.newPage()
      await page.route('https://challenges.cloudflare.com/**', (route) => route.abort())
      await openApp(page, [fixtureProject({ technique: 'loom' })])
      await open(page)
      const sheet = page.getByTestId('feedback-sheet')
      await expect(sheet).toHaveAttribute('data-kind', kind)
      await page.getByTestId('feedback-also-sent-toggle').click()
      await page.mouse.move(5, 5)
      await settle(page)
      // The Also sent block names the app's version, this browser and the window: those values are masked, not their rows.
      const machine = ['appVersion', 'browser', 'os', 'viewport'].map((key) => `[data-testid="feedback-also-sent"] [data-key="${key}"] dd`)
      await expect(sheet).toHaveScreenshot(`feedback-${kind}-${screen.name}.png`, { maxDiffPixelRatio: 0.01, mask: [page.locator(machine.join(', '))] })
      await context.close()
    })
  }
}

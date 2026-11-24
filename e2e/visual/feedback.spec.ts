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
      await page.locator('[data-testid="language-switcher"] button[aria-haspopup]').click()
      await page.getByTestId('menu-report-translation').click()
    },
  },
  {
    kind: 'bead-color',
    open: async (page) => {
      await openColorPopover(page)
      await page.getByTestId('add-color-button').click()
      await page.getByTestId('bead-colors-report').click()
    },
  },
]

/** What the Also sent block shows of the build and the machine, as the screenshots have it. */
const MACHINE = { appVersion: '1.0.0 · 0000000', browser: 'Chromium 100', os: 'Linux', viewport: '1400 × 1300' }

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
      // No motion at all: the sheet's fade-in, running or not when captured, moved some of its blocks a pixel. That
      // depended on timing, so the check failed now and then with no change (a reduced-motion fade still runs).
      await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important }' })
      await open(page)
      const sheet = page.getByTestId('feedback-sheet')
      await expect(sheet).toHaveAttribute('data-kind', kind)
      await page.getByTestId('feedback-also-sent-toggle').click()
      await page.mouse.move(5, 5)
      await settle(page)
      // The Also sent block names the Build's Version, this browser and the window. Each is given a fixed text of its
      // own kind, not a mask: a mask is as wide as the value under it, so a Version one character longer moved more of
      // the phone's pixels than the check lets differ, on every branch at once (ticket 1143).
      await page.getByTestId('feedback-also-sent').evaluate((block, fixed) => {
        for (const [key, text] of Object.entries(fixed)) block.querySelector(`[data-key="${key}"] dd`)!.textContent = text
      }, MACHINE)
      await expect(sheet).toHaveScreenshot(`feedback-${kind}-${screen.name}.png`, { maxDiffPixelRatio: 0.01 })
      await context.close()
    })
  }
}

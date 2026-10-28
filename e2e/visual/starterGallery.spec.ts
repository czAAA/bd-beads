import { expect, test, type Page } from '@playwright/test'
import { openApp, openStripPanel } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The Starter gallery from New Project's Pick a starter (tickets 0596, 0597): step 1 the categories, step 2 the Shapes,
 * Earrings, Rings and Bands, and the Star's and the V fringe's setups, in the Menu's dropdown in light and dark; the
 * Shapes also in high contrast and at phone width. */
const LEVELS: readonly { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'categories', open: async () => {} },
  { name: 'shapes', open: async (page) => page.getByTestId('starter-category-shapes').click() },
  {
    name: 'setup',
    open: async (page) => {
      await page.getByTestId('starter-category-shapes').click()
      await page.getByTestId('starter-card-star').click()
    },
  },
  ...(['earrings', 'rings', 'bands'] as const).map((category) => ({ name: category, open: async (page: Page) => page.getByTestId(`starter-category-${category}`).click() })),
  {
    name: 'earring-setup',
    open: async (page) => {
      await page.getByTestId('starter-category-earrings').click()
      await page.getByTestId('starter-card-vFringe').click()
    },
  },
]

const CASES = [
  ...(['light', 'dark'] as const).flatMap((look) => LEVELS.map((level) => ({ level, look }))),
  { level: LEVELS[1]!, look: 'contrast' as const },
  { level: LEVELS[1]!, look: 'phone' as const },
]

for (const { level, look } of CASES) {
  test(`Starter gallery, ${level.name}, ${look}`, async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: look === 'dark' ? 'dark' : 'light',
      viewport: look === 'phone' ? { width: 390, height: 800 } : { width: 1400, height: 1100 },
      reducedMotion: 'reduce',
      ...(look === 'contrast' ? { contrast: 'more' as const } : {}),
    })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await openStripPanel(page, 'strip-menu')
    await page.getByTestId('menu-new-project').click()
    await page.getByTestId('pick-starter').click()
    await level.open(page)
    await expect(page.getByTestId('panel-sub-title')).toBeVisible()
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('panel-dropdown')).toHaveScreenshot(`starter-gallery-${level.name}-${look}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

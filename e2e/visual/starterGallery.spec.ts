import { expect, test } from '@playwright/test'
import { openApp, openStripPanel } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The Starter gallery unfolded by New Project's Pick a starter (tickets 493, 494, 568): the Menu's dropdown in each theme, high contrast too, and at phone width. */
for (const [name, scheme, viewport, panel] of [
  ['light', 'light', { width: 1400, height: 900 }, 'panel-dropdown'],
  ['dark', 'dark', { width: 1400, height: 900 }, 'panel-dropdown'],
  ['contrast', 'light', { width: 1400, height: 900 }, 'panel-dropdown'],
  ['phone', 'light', { width: 390, height: 800 }, 'panel-dropdown'],
] as const) {
  test(`Starter gallery, ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, viewport, reducedMotion: 'reduce', ...(name === 'contrast' ? { contrast: 'more' as const } : {}) })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await openStripPanel(page, 'strip-menu')
    await page.getByTestId('menu-new-project').click()
    await page.getByTestId('pick-starter').click()
    await expect(page.getByTestId('starter-gallery')).toBeVisible()
    await page.getByTestId('starter-card-custom').scrollIntoViewIfNeeded()
    await page.mouse.move(5, 5)
    await expect(page.getByTestId(panel)).toHaveScreenshot(`starter-gallery-${name}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

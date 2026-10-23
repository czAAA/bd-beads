import { expect, test } from '@playwright/test'
import { openApp, openDockSheet } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The Template gallery at the top of New Project (ticket 493, 494): the Menu's dropdown in each theme, high contrast too, and at phone width. */
for (const [name, scheme, viewport, panel] of [
  ['light', 'light', { width: 1400, height: 900 }, 'panel-dropdown'],
  ['dark', 'dark', { width: 1400, height: 900 }, 'panel-dropdown'],
  ['contrast', 'light', { width: 1400, height: 900 }, 'panel-dropdown'],
  ['phone', 'light', { width: 390, height: 800 }, 'panel-dropdown'],
] as const) {
  test(`Template gallery, ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, viewport, reducedMotion: 'reduce', ...(name === 'contrast' ? { contrast: 'more' as const } : {}) })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await openDockSheet(page, 'strip-menu')
    await page.getByTestId('menu-new-project').click()
    await expect(page.getByTestId('template-gallery')).toBeVisible()
    await page.mouse.move(5, 5)
    await expect(page.getByTestId(panel)).toHaveScreenshot(`template-gallery-${name}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

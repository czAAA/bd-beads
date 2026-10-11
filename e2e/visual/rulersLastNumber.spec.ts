import { expect, test } from '@playwright/test'
import { openApp, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/**
 * The rulers zoomed out below 50% (ticket 303): each shows only its last number, the column count along the columns
 * and the row count along the rows, at 20% and at the Zoom floor, 10%.
 */
for (const zoom of [20, 10]) {
  test(`rulers show only their last number at ${zoom}%`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, zoom)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`rulers-last-number-${zoom}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

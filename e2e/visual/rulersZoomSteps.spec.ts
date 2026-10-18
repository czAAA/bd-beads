import { expect, test } from '@playwright/test'
import { openApp, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** Rulers from 100% to the Zoom floor (ticket 301, ADR 0033): all numbers at 100%, wider Ruler step with dots at
 * 50%/25%, last number at 10%. */
for (const zoom of [100, 50, 25, 10]) {
  test(`rulers at ${zoom}%`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, zoom)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`rulers-zoom-${zoom}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

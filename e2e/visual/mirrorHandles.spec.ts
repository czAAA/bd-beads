import { expect, test } from '@playwright/test'
import { openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** Mirror's Axes on the open Canvas (ticket 0704, MirrorPopover card): with no Frame and both straight Axes on, a
 * dashed line across the whole view per Axis, each with its 32px handle chip 56px in from the view's edge, the same
 * size at 100% and 300%. */
for (const zoom of [100, 300]) {
  test(`the Axis lines and handles on the open Canvas at ${zoom}%`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const framed = fixtureProject({ technique: 'loom', blank: true })
    await openApp(page, [{ ...framed, layers: [framed.layers[0]] }])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, zoom)
    await page.getByTestId('pill-tool-mirror').click()
    await page.getByTestId('mirror-axis-leftRight').click()
    await page.getByTestId('mirror-axis-topBottom').click()
    await page.keyboard.press('Escape')
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot(`mirror-handles-canvas-${zoom}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

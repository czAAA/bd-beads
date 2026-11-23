import { expect, test } from '@playwright/test'
import { gridBox, openApp, selectTool, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'

/** The Selection bar's Export (ticket 1210): its panel hangs from the bar, says what it exports, keeps its settings folded,
 * and saves a file named for the part. */
test('the Selection bar’s Export opens the folded Export panel for the Selection alone and saves a part', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce', colorScheme: 'light', acceptDownloads: true })
  const page = await context.newPage()
  const project = fixtureProject({ technique: 'loom', columns: 30, rows: 20 })
  await openApp(page, [project])
  await selectTool(page, 'select')
  const zoom = Number(await page.getByTestId('canvas-strip-zoom').getAttribute('data-zoom-percent')) / 100
  const box = await gridBox(page)
  const start = beadCentre(project, box, zoom, { row: 4, column: 4 })
  const end = beadCentre(project, box, zoom, { row: 9, column: 11 })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()
  await page.mouse.move(5, 5)
  await settle(page)

  // The bar arms a moment after a Selection is made (ticket 499): wait until its button answers.
  await expect(page.getByTestId('context-bar-export')).not.toHaveAttribute('aria-disabled', 'true')
  await page.getByTestId('context-bar-export').click()
  await expect(page.getByTestId('export-panel-scope')).toHaveText(/^Exporting the Selection · \d+×\d+$/)
  await expect(page.getByTestId('export-cover-page')).toHaveCount(0)
  await page.mouse.move(5, 5)
  await settle(page)
  await expect(page.getByTestId('app-canvas')).toHaveScreenshot('export-selection-panel.png', { maxDiffPixelRatio: 0.002 })

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-png').click()])
  expect(download.suggestedFilename()).toMatch(/-part\.png$/)
  await context.close()
})

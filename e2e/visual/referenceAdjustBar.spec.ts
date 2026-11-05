import { expect, test } from '@playwright/test'
import { openApp, settle } from '../support/app'
import { fixturePicture } from '../support/picture'
import { fixtureProject } from '../support/projects'

/** The Adjust bar floats over the drawing (ReferenceImage card): a pill centred 14px above the drawing area's bottom,
 * never a full-width row in the flow that takes height from the canvas, as a shared positioning rule once made it
 * (ticket 0800). */
test('the Adjust bar is a pill centred above the drawing area’s bottom', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  const row = (await page.locator('.app-shell__canvas-row').boundingBox())!
  await page.getByTestId('strip-reference-image-input').setInputFiles({ name: 'picture.png', mimeType: 'image/png', buffer: fixturePicture() })
  const bar = page.getByTestId('reference-adjust-bar')
  await expect(bar).toBeVisible()
  await settle(page)

  const drawing = (await page.getByTestId('app-drawing-area').boundingBox())!
  const box = (await bar.boundingBox())!
  expect(box.width).toBeLessThan(drawing.width / 2)
  expect(box.x + box.width / 2).toBeCloseTo(drawing.x + drawing.width / 2, 0)
  expect(drawing.y + drawing.height - (box.y + box.height)).toBeCloseTo(14, 0)
  // The canvas keeps its height while the bar shows.
  expect((await page.locator('.app-shell__canvas-row').boundingBox())!.height).toBeCloseTo(row.height, 0)
})

import { expect, test } from '@playwright/test'
import { openApp, closeSheet, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

/** Menu, Project and the Frame bar are one panel (tickets 510, 511), placed by PanelShell alone: a Top sheet that hangs
 * from the strip below 1024px, a dropdown under its own button from it, the same for all three wherever they are mounted. */

const WIDTHS = [
  ['phone', 390, 844],
  ['iPad 8" portrait', 744, 1133],
  ['iPad 11" portrait', 820, 1180],
  ['iPad landscape', 1024, 768],
  ['desktop', 1440, 900],
] as const

for (const [name, width, height] of WIDTHS) {
  test(`Menu, Project and Frame are placed alike on ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width < 1024 })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    const strip = (await page.getByTestId('canvas-strip').boundingBox())!
    const sheet = width < 1024
    for (const id of ['strip-menu', 'strip-project', 'strip-frame'] as const) {
      await closeSheet(page)
      const button = (await page.getByTestId(id).boundingBox())!
      await page.getByTestId(id).click()
      await settle(page)
      const panel = page.getByTestId(sheet ? 'top-sheet' : 'panel-dropdown')
      await expect(panel, id).toHaveCount(1)
      const box = (await panel.boundingBox())!
      // Top sheet: from the strip's bottom edge. Dropdown: under its own button, starting at the button's left edge.
      if (sheet) expect(box.y, id).toBeCloseTo(strip.y + strip.height, 0)
      else {
        expect(box.y, id).toBeGreaterThanOrEqual(button.y + button.height)
        expect(box.y - (button.y + button.height), id).toBeLessThan(12)
        expect(box.x, id).toBeCloseTo(button.x, 0)
      }
    }
    await context.close()
  })
}

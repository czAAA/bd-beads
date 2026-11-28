import { expect, test } from '@playwright/test'
import { openApp, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// Expand the Frame (MarginSheet card, Calmer sheet 3; ticket 1260): the two rails round the rows and the band over a
// wide Frame, on the owner's desktop and an iPad, and a wheel along the rows keeping the Frame expanded.
const SIZES = { desktop: { width: 1710, height: 907 }, ipad: { width: 1366, height: 1024 } } as const
const SHAPES = { rails: { columns: 24, rows: 70 }, band: { columns: 100, rows: 11 } } as const

for (const [size, viewport] of Object.entries(SIZES)) {
  for (const [layout, shape] of Object.entries(SHAPES)) {
    test(`the expanded Frame lies in its ${layout} on ${size}, Export unfolded, and its rows scroll`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await openApp(page, [fixtureProject({ technique: 'loom', ...shape, rowProgress: { currentRow: 3 } })])
      await page.getByTestId('margin-expand-frame').or(page.getByTestId('margin-handle-expand-frame')).first().click()
      const rails = page.getByTestId('margin-rails')
      await expect(rails).toHaveClass(new RegExp(`margin-rails--${layout}`))
      await page.mouse.move(viewport.width / 2, viewport.height * 0.7)
      await page.mouse.wheel(layout === 'rails' ? 0 : 300, layout === 'rails' ? 300 : 0)
      await page.getByTestId('margin-rail-export').click()
      await page.getByTestId('export-settings-row').click()
      await expect(page.getByTestId('export-cover-page')).toBeVisible()
      await settle(page)
      await expect(rails).toBeVisible()
      await page.mouse.move(0, 0)
      await expect(page).toHaveScreenshot(`expanded-${layout}-${size}.png`, { maxDiffPixelRatio: 0.002 })
      // A move across the rows goes back to the Canvas.
      await page.mouse.move(viewport.width / 2, viewport.height * 0.7)
      await page.mouse.wheel(layout === 'rails' ? 300 : 0, layout === 'rails' ? 0 : 300)
      await expect(rails).toHaveCount(0)
    })
  }
}

test('the focus goes with Expand the Frame to Back to the Canvas and back', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  const expand = page.getByTestId('margin-expand-frame')
  await expect(expand).toBeVisible()
  await settle(page)
  for (const name of ['Back to the Canvas', 'Expand the Frame']) {
    await expand.focus()
    // The keys are the Canvas's (Space pans, Enter moves Row progress), so the button is pressed by script.
    await expand.evaluate((button: HTMLElement) => button.click())
    await expect(expand).toHaveAccessibleName(name)
    await expect(expand).toBeFocused()
  }
})

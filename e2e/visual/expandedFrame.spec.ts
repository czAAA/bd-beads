import { expect, test } from '@playwright/test'
import { openApp, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// Expand the Frame (MarginSheet card, Calmer sheet 3; ticket 1260): the two rails round the rows and the band over a
// wide Frame, on the owner's desktop and an iPad, a wheel along the rows keeping the Frame expanded and the Tool pill's
// four places round it (ticket 1259).
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

for (const [size, viewport] of Object.entries(SIZES)) {
  test(`the Tool pill's four places stand round the expanded Frame on ${size}, and a drop beside it moves it over`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openApp(page, [fixtureProject({ technique: 'loom', columns: 10, rows: 70 })])
    await page.getByTestId('margin-expand-frame').or(page.getByTestId('margin-handle-expand-frame')).first().click()
    const pill = page.getByTestId('tool-pill')
    await expect(page.getByTestId('margin-rails')).toBeVisible()
    await expect(pill).toHaveAttribute('data-position', 'bottom')
    await settle(page)
    const grip = (await page.getByTestId('tool-pill-grip').boundingBox())!
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(grip.x, grip.y - 40, { steps: 4 })
    const left = (await page.getByTestId('tool-pill-zone-left').boundingBox())!
    await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2, { steps: 8 })
    await expect(page.getByTestId('tool-pill-zone-left')).toHaveClass(/tool-pill-zone--near/)
    await settle(page)
    await expect(page).toHaveScreenshot(`expanded-pill-places-${size}.png`, { maxDiffPixelRatio: 0.002 })
    await page.mouse.up()
    await expect(pill).toHaveAttribute('data-position', 'left')
    await page.mouse.move(0, 0)
    await settle(page)
    await expect(page).toHaveScreenshot(`expanded-pill-left-${size}.png`, { maxDiffPixelRatio: 0.002 })
    // Beside the narrow Frame, not out at the rail.
    const [box, rows] = [(await pill.boundingBox())!, (await page.getByTestId('margin-rails-window').boundingBox())!]
    expect(box.x).toBeGreaterThan(rows.x)
  })
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

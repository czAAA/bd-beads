import { expect, test, type Page } from '@playwright/test'
import { openApp, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** A popup hung from a button opens straight under it (ticket 0804). Playwright's WebKit never showed the Safari bug (the menu painted at the window's corner, then jumped), so this pins the place in Chromium; `docs/testing.md` has the manual real-Safari script. */

/** Opens the Frame tools menu inside `scope` and checks it hangs under its "…" and stays inside `room`. */
async function expectUnderButton(page: Page, scope: string, room?: string) {
  const button = page.locator(`${scope} [data-testid="margin-frame-tools"]`).first()
  await expect(button).toBeVisible()
  await button.click()
  const menu = page.locator(`${scope} [data-testid="margin-frame-tools-mirror"], [data-testid="margin-frame-tools-mirror"]`).first()
  await expect(menu).toBeVisible()
  const list = menu.locator('xpath=ancestor::*[@popover][1]')
  const anchor = (await button.boundingBox())!
  const placed = (await list.boundingBox())!
  expect(Math.abs(placed.y - (anchor.y + anchor.height + 4)), 'the menu starts 4px under the button').toBeLessThan(2)
  expect(Math.abs(placed.x + placed.width - (anchor.x + anchor.width)), 'an end-aligned menu ends at the button').toBeLessThan(2)
  if (room) {
    const box = (await page.locator(room).boundingBox())!
    expect(placed.x).toBeGreaterThanOrEqual(box.x)
    expect(placed.x + placed.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
    expect(placed.y + placed.height).toBeLessThanOrEqual(box.y + box.height + 0.5)
  }
}

test('the Frame tools menu opens under its button in the full editor', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 8 })])
  await setZoom(page, 100)
  await expectUnderButton(page, 'body', 'body')
})

test('the Frame tools menu stays inside the What\'s inside box', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, [], './homepage/')
  await expect(page.getByTestId('inside-editor')).toBeVisible()
  await expectUnderButton(page, '[data-testid="inside-editor"]', '[data-testid="inside-editor"]')
})

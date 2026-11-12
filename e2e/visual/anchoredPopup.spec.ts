import { expect, test, type Page } from '@playwright/test'
import { openApp, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** A popup hung from a button opens straight under it (ticket 0804). Playwright's WebKit never showed the Safari bug (the menu painted at the window's corner, then jumped), so this pins the place in Chromium; `docs/testing.md` has the manual real-Safari script. */

/** The Frame tools menu, hung from the band's "…" with an item of its own to wait for. */
const FRAME_TOOLS = { button: 'margin-frame-tools', item: 'margin-frame-tools-mirror' }

/** Opens a popup inside `scope` from its button (the Frame tools menu unless named) and checks it hangs under the button
 * and stays inside `room`. `byGhost` presses it as the demo's ghost does, the control's own click: the demo is inert to
 * a visitor's press (ticket 0879). */
async function expectUnderButton(page: Page, scope: string, room?: string, { button: buttonId, item, byGhost = false }: { button: string; item: string; byGhost?: boolean } = FRAME_TOOLS) {
  const button = page.locator(`${scope} [data-testid="${buttonId}"]`).first()
  await expect(button).toBeVisible()
  if (byGhost) await button.evaluate((element: HTMLElement) => element.click())
  else await button.click()
  const menu = page.locator(`${scope} [data-testid="${item}"], [data-testid="${item}"]`).first()
  await expect(menu).toBeVisible()
  const list = menu.locator('xpath=ancestor-or-self::*[@popover][1]')
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

// The ring's band has room for its own buttons at every demo size, so no Frame tools menu: its Margin color popover,
// hung from the band the same way, is the one tried (ticket 0821).
test('the Margin color popover stays inside the What\'s inside box', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, [], './homepage/', { canvasHidden: true })
  // Welcome comes first (ticket 0830): the demo shows once the page is turned to What's inside.
  await page.locator('[data-testid="section-step"][data-step="inside"]').click()
  await expect(page.getByTestId('inside-editor')).toBeVisible()
  await expectUnderButton(page, '[data-testid="inside-editor"]', '[data-testid="inside-editor"]', { button: 'margin-color', item: 'margin-color-popover', byGhost: true })
})

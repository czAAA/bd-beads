import { expect, test } from '@playwright/test'
import { gridBox, openApp, selectTool, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'

/** Rotate waits under the pointer on the Selection bar, as Rotate Frame does on the margin (ContextBar card): a long
 * Selection turned moves its bar, but four clicks without moving the mouse turn it four times and bring it back. */
test('Rotate on the Selection bar stays under the mouse while the Selection turns', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const project = fixtureProject({ technique: 'loom', columns: 40, rows: 30, blank: true })
  await openApp(page, [project])
  await selectTool(page, 'select')
  const zoom = Number(await page.getByTestId('canvas-strip-zoom').getAttribute('data-zoom-percent')) / 100
  const box = await gridBox(page)
  const start = beadCentre(project, box, zoom, { row: 10, column: 6 })
  const end = beadCentre(project, box, zoom, { row: 13, column: 25 })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()
  await settle(page)

  const readout = page.getByTestId('context-bar-size')
  const before = await readout.textContent()
  const rotate = page.getByTestId('context-bar-rotate')
  await expect(rotate).not.toHaveAttribute('aria-disabled', 'true')
  const pressed = (await rotate.boundingBox())!
  const at = { x: pressed.x + pressed.width / 2, y: pressed.y + pressed.height / 2 }
  await page.mouse.move(at.x, at.y)
  await page.mouse.click(at.x, at.y)
  await settle(page)

  // The bar moved with the turned Selection; the copy stands where the button was, under the mouse.
  expect(await readout.textContent()).not.toBe(before)
  const copy = page.getByTestId('context-bar-rotate-copy')
  await expect(copy).toBeVisible()
  const copied = (await copy.locator('button').boundingBox())!
  expect([copied.x, copied.y]).toEqual([pressed.x, pressed.y])
  for (let press = 0; press < 3; press++) {
    await page.mouse.click(at.x, at.y)
    await settle(page)
  }
  expect(await readout.textContent()).toBe(before)

  // Moved away, it fades and goes.
  await page.mouse.move(5, 5)
  await expect(copy).toHaveCount(0)
  await context.close()
})

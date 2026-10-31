import { expect, test } from '@playwright/test'
import { gridBox, openApp, settle, setZoom } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'

/** The Mirror set up like a Selection (ticket 0750, ContextBar card's Mirror bar): a Mirror-mode drag on the Canvas
 * beside a peyote Frame, drawn as the Selection (the marker rectangle, the eight handles) with its Left–right Axis
 * inside and the Mirror bar above it; and the whole Frame as the Mirror, from its margin's button (MarginSheet card). */
test.describe('the Mirror and its Area', () => {
  test.use({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })

  test('a Canvas Area beside the Frame, its Axis inside it and the Mirror bar above it', async ({ page }) => {
    await openApp(page, [fixtureProject({ technique: 'peyote' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, 100)
    await page.getByTestId('pill-tool-mirror').click()
    const box = await gridBox(page)
    const from = beadCentre({ technique: 'peyote', rotation: 0 }, box, 1, { row: 2, column: -14 })
    const to = beadCentre({ technique: 'peyote', rotation: 0 }, box, 1, { row: 7, column: -7 })
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 6 })
    await page.mouse.up()
    await expect(page.getByTestId('mirror-bar')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot('mirror-area-canvas.png', { maxDiffPixelRatio: 0.01 })
  })

  test('the whole Frame as the Mirror, its margin button lit and the Mirror bar above the sheet', async ({ page }) => {
    await openApp(page, [fixtureProject({ technique: 'peyote' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, 100)
    await page.getByTestId('margin-mirror-frame').click()
    await expect(page.getByTestId('mirror-bar')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot('mirror-whole-frame-peyote.png', { maxDiffPixelRatio: 0.01 })
  })
})

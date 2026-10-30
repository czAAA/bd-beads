import { expect, test } from '@playwright/test'
import { gridBox, openApp, settle, setZoom } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'

/** Mirror's Area on a peyote Frame (ticket 0710, MirrorPopover card): Select area, a drag over the beads, and the Area
 * drawn as the Selection (the marker rectangle round the cells, the peyote half-bead included, the eight handles) with
 * the Left–right Axis inside it; and, while picking, the keep-out margin as the whole Frame's target under the pointer
 * (the sheet tinted, its edge solid, the dashed preview round the Frame, MarginSheet card). */
test.describe('Mirror\'s Area', () => {
  test.use({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })

  async function startPicking(page: Parameters<typeof openApp>[0]) {
    await openApp(page, [fixtureProject({ technique: 'peyote' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, 100)
    await page.getByTestId('pill-tool-mirror').click()
    await page.getByTestId('mirror-axis-leftRight').click()
    await page.getByTestId('mirror-select-area').click()
    await expect(page.getByTestId('canvas-hint-picking')).toBeVisible()
  }

  test('the Area on a peyote Frame, the Axis inside it', async ({ page }) => {
    await startPicking(page)
    const box = await gridBox(page)
    const from = beadCentre({ technique: 'peyote', rotation: 0 }, box, 1, { row: 2, column: 3 })
    const to = beadCentre({ technique: 'peyote', rotation: 0 }, box, 1, { row: 7, column: 10 })
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 6 })
    await page.mouse.up()
    await expect(page.getByTestId('mirror-select-area')).toHaveText('8 × 6 beads')
    await page.keyboard.press('Escape')
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot('mirror-area-peyote-frame.png', { maxDiffPixelRatio: 0.01 })
  })

  test('the keep-out margin as the whole Frame\'s target under the pointer', async ({ page }) => {
    await startPicking(page)
    const box = await gridBox(page)
    const margin = beadCentre({ technique: 'peyote', rotation: 0 }, box, 1, { row: -2, column: 6 })
    await page.mouse.move(margin.x, margin.y)
    await expect(page.getByTestId('margin-sheet')).toHaveClass(/margin-sheet--target/)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot('mirror-area-margin-target.png', { maxDiffPixelRatio: 0.01 })
  })
})

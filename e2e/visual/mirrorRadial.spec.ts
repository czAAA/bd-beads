import { expect, test } from '@playwright/test'
import { openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** Radial on a loom Frame (ticket 0705, MirrorPopover card): Mirror at Fold 4 (the Frame's ring with four mirror lines,
 * the vertical full, the others soft, clipped to the Frame) and Repeat at Fold 3 (three rays, the first straight up).
 * The Canvas's own centre lands over the Frame's, so its chip is dragged to the top left first, its lines across the view. */
for (const [mode, fold] of [['mirror', 4], ['repeat', 3]] as const) {
  test(`the Radial overlay on a loom Frame in ${mode} mode at Fold ${fold}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom', blank: true })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, 100)
    await page.getByTestId('pill-tool-mirror').click()
    await page.getByTestId('mirror-axis-radial').click()
    for (let step = 2; step < fold; step++) await page.getByTestId('mirror-fold-more').click()
    if (mode === 'repeat') await page.getByRole('radio', { name: 'Repeat' }).click()
    await page.keyboard.press('Escape')
    await settle(page)
    const box = (await page.getByTestId('project-surface').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 120, { steps: 6 })
    await page.mouse.up()
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot(`mirror-radial-frame-${mode}-${fold}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

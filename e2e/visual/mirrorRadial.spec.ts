import { expect, test } from '@playwright/test'
import { openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** Radial on a loom Frame (ticket 0705, MirrorPopover card): the kaleidoscope overlay, Mirror mode at Fold 4: the
 * centre ring with the four mirror lines through it, the vertical one full and the others soft, clipped to the Frame;
 * and in Repeat mode at Fold 3 the three sector rays, the first straight up. */
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
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot(`mirror-radial-frame-${mode}-${fold}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

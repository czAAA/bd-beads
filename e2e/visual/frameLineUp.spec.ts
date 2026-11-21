import { expect, test } from '@playwright/test'
import { beadsOfLayer, frameOf } from '../../src/domain/layerRecord'
import { twistFrameTo } from '../../src/domain/rotate'
import { openApp, savedProject, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// Remove frame's line-up (ticket 1189): a Frame leaning on an upright Canvas turns into line with it, slides onto whole
// positions and drops its beads, the very piece it was, in Safari's engine at an iPad's density, as the owner's iPad.

// The config's launch flags are Chromium's: WebKit on Linux refuses to start with them.
test.use({ browserName: 'webkit', deviceScaleFactor: 2, viewport: { width: 1366, height: 1024 }, launchOptions: { args: [] } })

for (const { technique, angle } of [
  { technique: 'loom', angle: 28 },
  { technique: 'peyote', angle: 160 },
] as const) {
  test(`a ${technique} Frame leaning at ${angle}° lines up with the Canvas, then drops its beads`, async ({ page }) => {
    const upright = fixtureProject({ technique })
    const leaning = twistFrameTo(upright, angle)!
    await openApp(page, [leaning])
    await settle(page)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`frame-line-up-${technique}-leaning.png`, { maxDiffPixelRatio: 0.01 })

    // Remove Frame from the Frame panel, which shows it whatever room the margin sheet's band has.
    await page.getByRole('button', { name: 'Frame', exact: true }).click()
    await page.getByTestId('frame-panel').getByTestId('frame-chrome-remove').click()
    await page.getByTestId('remove-frame-modal').getByRole('button', { name: 'Remove Frame' }).click()
    // The line-up eases over the base duration, then the sheet fades off the beads over it again.
    await expect.poll(async () => frameOf(await savedProject(page))).toBeUndefined()
    await page.waitForTimeout(400)
    if (await page.getByTestId('frame-panel').isVisible()) await page.keyboard.press('Escape')
    await settle(page)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`frame-line-up-${technique}-dropped.png`, { maxDiffPixelRatio: 0.01 })

    // Every bead of the Frame lies on the Canvas.
    const count = (beads: Record<number, Record<number, string>>) => Object.values(beads).reduce((sum, row) => sum + Object.keys(row).length, 0)
    expect(count(beadsOfLayer(await savedProject(page), 'canvas'))).toBe(count(beadsOfLayer(leaning, 'frame')!) + count(beadsOfLayer(leaning, 'canvas')))
  })
}

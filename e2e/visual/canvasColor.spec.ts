import { expect, test } from '@playwright/test'
import { openApp } from '../support/app'
import { fixtureProject } from '../support/projects'

/**
 * The Canvas color picker open on a non-default background (ticket 252): Linen in light, Ash (the lightest dark one,
 * with its own ruler, empty bead and rim colors) in dark. The picture is the canvas strip, the picker and the drawing area.
 */
for (const [scheme, choice, name] of [
  ['light', 2, 'linen'],
  ['dark', 6, 'ash'],
] as const) {
  test(`canvas color picker open on ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.addInitScript((value) => localStorage.setItem('bd-beads:canvas-background', value), String(choice))
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await page.getByTestId('canvas-color-button').click()
    await expect(page.getByTestId('canvas-color-picker')).toBeVisible()
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`canvas-color-${name}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

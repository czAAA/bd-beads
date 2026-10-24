import { expect, test } from '@playwright/test'
import { openApp, openStripPanel } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The Canvas section open on a non-default background (tickets 252, 443): Linen in light, Ash (lightest dark, own
 * ruler/bead/rim colors) in dark. */
for (const [scheme, choice, name] of [
  ['light', 2, 'linen'],
  ['dark', 6, 'ash'],
] as const) {
  test(`canvas color picker open on ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.addInitScript((value) => localStorage.setItem('openbeads:canvas-background', value), String(choice))
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await openStripPanel(page, 'strip-project')
    await expect(page.getByTestId('canvas-color-picker')).toBeVisible()
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`canvas-color-${name}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

/** Position marks (ticket 348): the Canvas with an outline round each empty position, per Technique. */
for (const technique of ['loom', 'peyote', 'brick'] as const) {
  test(`position marks as squares, ${technique}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`position-marks-squares-${technique}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

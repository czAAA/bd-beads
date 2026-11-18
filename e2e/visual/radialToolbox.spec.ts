import { expect, test } from '@playwright/test'
import { openApp } from '../support/app'
import { fixtureProject } from '../support/projects'

// The Radial toolbox open on a bead (ticket 1064, RadialToolbox card), in light, dark and high contrast: the band and
// its shadow over the beads, the ten items in their places, Paint pressed, two recent colours and the place of a third
// that does not exist yet, Undo and Redo off, and the name of the item under the pointer over the ring.
const SCHEMES = { light: { colorScheme: 'light' }, dark: { colorScheme: 'dark' }, contrast: { colorScheme: 'light', contrast: 'more' } } as const

/** How far the shot reaches from the ring's centre: the ring, its shadow, and its name over it. */
const REACH = { side: 150, up: 170, down: 130 }

for (const scheme of ['light', 'dark', 'contrast'] as const) {
  test(`the Radial toolbox open on a bead, ${scheme}`, async ({ browser }) => {
    const context = await browser.newContext({ ...SCHEMES[scheme], viewport: { width: 1000, height: 700 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    // Two colours used before the chosen one: the third recent keeps its place as a dashed ring.
    await page.addInitScript(() => localStorage.setItem('openbeads:recent-colors', '#1d3557,#f1c453'))
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)

    const surface = (await page.getByTestId('project-surface').boundingBox())!
    const centre = { x: Math.round(surface.x + surface.width / 2), y: Math.round(surface.y + surface.height / 2) }
    await page.mouse.click(centre.x, centre.y, { button: 'right' })
    const ring = page.getByTestId('radial-toolbox')
    await expect(ring).toBeVisible()
    await page.getByTestId('radial-pick-color').hover()
    await expect(page.getByTestId('radial-name')).toBeVisible()

    await expect(page).toHaveScreenshot(`radial-toolbox-${scheme}.png`, {
      clip: { x: centre.x - REACH.side, y: centre.y - REACH.up, width: 2 * REACH.side, height: REACH.up + REACH.down },
      maxDiffPixelRatio: 0.01,
    })
    await context.close()
  })
}

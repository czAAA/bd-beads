import { expect, test } from '@playwright/test'
import { openApp } from '../support/app'
import { pieceProject } from '../support/projects'

// A piece in a round Bead (ticket 1010, BeadBoard card, Lifted piece): each bead is its pill and its light, the piece's
// own ground shows between the beads, and the contour follows the beads. Night and Studio, three Techniques; a Frame.

/** A heart, two single beads beside it, and a pair. */
const PICTURE = ['.#.#.......', '#####..o...', '#####......', '.###....yy.', '..#........'] as const

for (const [scheme, name] of [
  ['light', 'studio'],
  ['dark', 'night'],
] as const) {
  for (const technique of ['loom', 'peyote', 'brick'] as const) {
    test(`a piece of round beads on ${name}, ${technique}`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
      const page = await context.newPage()
      await openApp(page, [pieceProject({ technique, beadId: 'toho-round-11-0', picture: PICTURE })])
      await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
      await page.mouse.move(5, 5)
      await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`round-beads-${name}-${technique}.png`, { maxDiffPixelRatio: 0.01 })
      await context.close()
    })
  }

  test(`a piece of round beads in a Frame on ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [pieceProject({ technique: 'loom', beadId: 'toho-round-11-0', picture: PICTURE, inFrame: true })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`round-beads-frame-${name}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

// A run of white round beads on Studio (ticket 1037): each white bead edged in its rim, as the ground between them is as
// light as they are; the heart beside them is not edged.
const WHITE_RUN = ['ooooo...#.#..', 'ooooo..#####.', '.......#####.', '........###..', '.........#...'] as const

for (const technique of ['loom', 'peyote', 'brick'] as const) {
  test(`a run of white round beads on studio, ${technique}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [pieceProject({ technique, beadId: 'toho-round-11-0', picture: WHITE_RUN })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`round-beads-white-run-studio-${technique}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

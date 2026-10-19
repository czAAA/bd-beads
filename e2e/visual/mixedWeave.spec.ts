import { expect, test } from '@playwright/test'
import { openApp } from '../support/app'
import { fixtureProject } from '../support/projects'

// A Frame woven in its own Technique over a Canvas woven in another (ticket 492): a peyote Frame on a loom Canvas, with
// a sketch beside it. The Frame is drawn in peyote from the corner of its Canvas position; the Canvas stays loom.
test('a peyote Frame on a loom Canvas', async ({ page }) => {
  const frame = fixtureProject({ technique: 'peyote' })
  const project = { ...frame, technique: 'loom' as const, beads: { 3: { 18: '#2f6fed', 19: '#e63746', 20: '#2f6fed' }, 4: { 18: '#e63746', 19: '#2f6fed', 20: '#e63746' } } }
  await openApp(page, [project])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await page.mouse.move(5, 5)
  await expect(page.getByTestId('app-canvas')).toHaveScreenshot('peyote-frame-on-loom-canvas.png', { maxDiffPixelRatio: 0.01 })
})

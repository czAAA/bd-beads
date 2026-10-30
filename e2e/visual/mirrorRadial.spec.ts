import { expect, test } from '@playwright/test'
import { openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'
import { changeFrame } from '../../src/domain/changeFrame'
import type { Project } from '../../src/domain/project'
import { withFrameSheet } from '../../src/domain/layerRecord'

/** Radial on a loom Frame (ticket 0705, MirrorPopover card): Mirror at Fold 4 (the Frame's ring with four mirror lines,
 * the vertical full, the others soft, clipped to the Frame) and Repeat at Fold 3 (three rays, the first straight up).
 * The Canvas's own centre lands over the Frame's, so its chip is dragged to the top left first, its lines across the view. */
for (const [mode, fold] of [['mirror', 4], ['repeat', 3]] as const) {
  test(`the Radial overlay on a loom Frame in ${mode} mode at Fold ${fold}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom' })])
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

/** A blank Star Frame of Part size 5 on a loom Canvas, as the Custom frame scenes place it. */
function starFramed(): Project {
  const open = withFrameSheet(fixtureProject({ technique: 'loom', blank: true }), undefined)
  const placed = changeFrame(open, { custom: { shape: 'star', size: 5, centre: { row: 8, column: 10 } } })
  if (placed.kind !== 'changed') throw new Error('expected a Star')
  return placed.project
}

/** Radial on a Star Frame (ticket 0706, MirrorPopover card): the Fold is the shape's five sides, the ring at the
 * layout's centre; in Mirror mode five mirror lines from the Seam between two arms (the first full, the others soft),
 * in Repeat mode five rays along the Seams between the arms. The Canvas's own centre chip is dragged aside first. */
for (const mode of ['mirror', 'repeat'] as const) {
  test(`the Radial overlay on a Star Frame in ${mode} mode`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [starFramed()])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, 100)
    await page.getByTestId('pill-tool-mirror').click()
    await page.getByTestId('mirror-axis-radial').click()
    await expect(page.getByTestId('mirror-sides-note')).toHaveText('5 sides, from the shape. Mirror reflects within each side too.')
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
    await expect(page.getByTestId('project-surface')).toHaveScreenshot(`mirror-radial-star-${mode}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

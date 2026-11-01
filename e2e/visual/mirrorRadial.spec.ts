import { expect, test } from '@playwright/test'
import { openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'
import { changeFrame } from '../../src/domain/changeFrame'
import { paintCells } from '../../src/domain/drawing'
import { frameLayoutOf } from '../../src/domain/frameShape'
import { onLayer } from '../../src/domain/layers'
import { frameOf, withFrameSheet } from '../../src/domain/layerRecord'
import type { Project } from '../../src/domain/project'

/** Radial on the whole loom Frame (tickets 0705, 0750; ContextBar card's Mirror bar): Mirror at Fold 4 (the Frame's ring
 * with four mirror lines, the vertical full, the others soft, clipped to the Frame) and Repeat at Fold 2 (two rays, the
 * first straight up), on a square Frame, since a quarter turn needs one (ticket 0751), set on the Mirror bar after the margin's Mirror the whole Frame. */
for (const [mode, fold] of [['mirror', 4], ['repeat', 2]] as const) {
  test(`the Radial overlay on a loom Frame in ${mode} mode at Fold ${fold}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom', columns: 16, rows: 16 })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, 100)
    await page.getByTestId('margin-mirror-frame').click()
    await page.getByTestId('mirror-bar-axis-radial').click()
    if (fold === 4) await page.getByTestId('mirror-bar-radial-more').click()
    if (mode === 'repeat') await page.getByRole('radio', { name: 'Repeat' }).click()
    await page.keyboard.press('Escape')
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot(`mirror-radial-frame-${mode}-${fold}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

/** A Star Frame of Part size 5 on a loom Canvas, as the Custom frame scenes place it, its first arm's rounds painted
 * a colour each, so the piece is not empty and the arm the lines run between shows. */
function starFramed(): Project {
  const open = withFrameSheet(fixtureProject({ technique: 'loom', blank: true }), undefined)
  const placed = changeFrame(open, { custom: { shape: 'star', size: 5, centre: { row: 8, column: 10 } } })
  if (placed.kind !== 'changed') throw new Error('expected a Star')
  const arm = frameLayoutOf(frameOf(placed.project)!)!.positions.filter(({ panel }) => panel < 4)
  return ['#e63746', '#f2c94c', '#2f6fed', '#27ae60', '#9b51e0'].reduce(
    (project, color, round) => onLayer(project, 'frame', (view) => paintCells(view, arm.filter(({ row }) => row === round), color)),
    placed.project,
  )
}

/** The whole-Frame Mirror on a Star Frame (tickets 0706, 0750): the shape's own Radial, its Fold the five sides, the
 * ring at the layout's centre; in Mirror mode five mirror lines from the Seam between two arms (the first full, the
 * others soft), in Repeat mode five rays along the Seams between the arms; the Mirror bar notes the shape's Axis. */
for (const mode of ['mirror', 'repeat'] as const) {
  test(`the Radial overlay on a Star Frame in ${mode} mode`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [starFramed()])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, 100)
    await page.getByTestId('margin-mirror-frame').click()
    if (mode === 'repeat') await page.getByRole('radio', { name: 'Repeat' }).click()
    await page.keyboard.press('Escape')
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('project-surface')).toHaveScreenshot(`mirror-radial-star-${mode}.png`, { maxDiffPixelRatio: 0.01 })
    await context.close()
  })
}

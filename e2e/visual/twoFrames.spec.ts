import { expect, test } from '@playwright/test'
import { gridBox, openApp, savedProject, setZoom, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { withFrameSheet } from '../../src/domain/frameSheet'
import { withFrameTurnedTo } from '../../src/domain/framePlacement'
import { beadsOfLayer, frameIdOf } from '../../src/domain/layerRecord'
import type { Project } from '../../src/domain/project'

// A Project file with two Frames opens and draws both (ticket 1219), what the app cannot make yet: each at its own place,
// angle and Bead size, with its own margin sheet, ground, rulers and Frame line, on the one Frame surface.

const SECOND = frameIdOf({ id: 'second' })

/** The busy loom fixture, 12 × 8, and beside it a loom Frame 6 × 8 of its own beads, upright or leaning 20°, or
 * blank. */
function leaningPair(leaning: boolean, blank = false): Project {
  const base = fixtureProject({ technique: 'loom', columns: 12, rows: 8 })
  const beads = blank ? {} : Object.fromEntries(Array.from({ length: 8 }, (_, row) => [row, Object.fromEntries(Array.from({ length: 6 }, (_, column) => [column, (row + column) % 3 === 0 ? '#2f6fed' : '#e63746']))]))
  const both = withFrameSheet(base, { row: 1, column: 22, rows: 8, columns: 6, beads, technique: 'loom' }, { frame: SECOND })
  return leaning ? withFrameTurnedTo(both, 20, SECOND) : both
}

for (const [name, media, zoom] of [
  ['light, full look', { colorScheme: 'light' }, 100],
  ['dark, draft look', { colorScheme: 'dark' }, 20],
  ['high contrast', { colorScheme: 'light', contrast: 'more' }, 100],
] as const) {
  test(`two Frames, the second leaning, ${name}`, async ({ page }) => {
    await page.emulateMedia(media)
    await openApp(page, [leaningPair(true)])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, zoom)
    await page.mouse.move(5, 5)
    await settle(page)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`two-frames-leaning-${name.replace(/, | /g, '-')}.png`, { maxDiffPixelRatio: 0.01 })
  })
}

test('a bead painted on the second Frame goes to that Frame', async ({ page }) => {
  await openApp(page, [leaningPair(false, true)])
  await setZoom(page, 100)
  const at = beadCentre({ technique: 'loom', rotation: 0 }, await gridBox(page), 1, { row: 3, column: 24 })
  await page.mouse.click(at.x, at.y)
  // Its own row 2, column 2: the Frame starts at row 1, column 22.
  await expect.poll(async () => Object.keys(beadsOfLayer(await savedProject(page), SECOND)?.[2] ?? {})).toEqual(['2'])
})

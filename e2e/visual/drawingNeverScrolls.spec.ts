import { expect, test } from '@playwright/test'
import { openApp } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The drawing area's boxes, which the browser could scroll and slide the drawn Canvas away from its overlays. */
const BOXES = ['app-drawing-area', 'canvas-scroll', 'project-surface']

// Ticket 1107: whatever scrolls one of them (a focus, a key), it is back at 0 before the next frames are drawn.
test('the drawing area\'s boxes never stay scrolled', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 37, rows: 28 })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  const left = await page.evaluate(async (testids) => {
    const tops: number[] = []
    for (const testid of testids) {
      const box = document.querySelector(`[data-testid="${testid}"]`)!
      box.scrollTop = 450
      await new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled)))
      tops.push(box.scrollTop)
    }
    return tops
  }, BOXES)
  expect(left).toEqual([0, 0, 0])
})

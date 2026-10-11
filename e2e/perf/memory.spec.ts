import { test } from '@playwright/test'
import { openApp, projectBox } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'

/**
 * Memory with a long Undo history on a big Project (ticket 112's other condition): how much the page's heap grows as a
 * 250 × 250 Project is painted a bead at a time, and then filled again and again (each Fill keeps a whole grid to Undo
 * to). Printed, not asserted: there is no agreed limit, only what a small device can be expected to hold.
 */
test('memory with a long Undo history at 250 × 250', async ({ page }) => {
  await openApp(page, [{ ...fixtureProject({ technique: 'loom', columns: 250, rows: 250, blank: true }), id: 'big' }])
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.enable')
  const heapMb = async () => {
    await cdp.send('HeapProfiler.collectGarbage')
    const { usedSize } = await cdp.send('Runtime.getHeapUsage')
    return Math.round(usedSize / 1024 / 1024)
  }

  await page.getByTestId('zoom-reset').click()
  const box = await projectBox(page, (await page.getByTestId('project-surface').boundingBox())!)
  const zoom = Number.parseInt((await page.getByTestId('zoom-level').textContent())!, 10) / 100
  const at = (row: number, column: number) => beadCentre({ technique: 'loom', rotation: 0 }, box, zoom, { row, column })
  const started = await heapMb()

  for (let stroke = 0; stroke < 300; stroke += 1) {
    const point = at(2 + (stroke % 20), 2 + ((stroke * 7) % 200))
    await page.mouse.click(point.x, point.y)
  }
  const afterStrokes = await heapMb()

  await page.getByTestId('tool-fill').click()
  const colors = ['red', 'blue', 'green', 'orange']
  for (let fill = 0; fill < 40; fill += 1) {
    await page.locator(`[data-color-id="${colors[fill % 4]}"]`).click()
    const point = at(100, 100)
    await page.mouse.click(point.x, point.y)
  }
  const afterFills = await heapMb()

  console.log(`\nMemory at 250 × 250: ${started} MB to start; ${afterStrokes} MB after 300 one-bead strokes; ${afterFills} MB after 40 whole-Project Fills`)
})

import { expect, test, type Page } from '@playwright/test'
import { gridBox, openApp, savedProject, setZoom, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { frameGrid } from '../../src/testUtils/frameGrid'
import type { Project } from '../../src/domain/project'

// Two tabs on one Project, with the browser's own Web Locks (ticket 0937): the second is read-only and says so, and
// Work here instead moves the Project to it, the first tab then read-only in its turn.

const painted = (project: Project) => frameGrid(project).flat().filter((cell) => cell.color !== null).length

/** A stroke across the bead row 2, columns 1 to 6. */
async function stroke(page: Page) {
  const grid = await gridBox(page)
  const start = beadCentre({ technique: 'loom', rotation: 0 }, grid, 1, { row: 2, column: 1 })
  const end = beadCentre({ technique: 'loom', rotation: 0 }, grid, 1, { row: 2, column: 6 })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()
  await settle(page)
}

test('a second tab draws nothing until Work here instead, then the first tab is the read-only one', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const project = fixtureProject({ technique: 'loom', blank: true })
  const first = await context.newPage()
  await openApp(first, [project])
  const second = await context.newPage()
  await openApp(second, [project])
  await setZoom(second, 100)

  await expect(second.getByTestId('open-elsewhere-message')).toBeVisible()
  await expect(first.getByTestId('open-elsewhere')).toHaveCount(0)
  await expect(second.getByTestId('pill-tool-paint')).toHaveAttribute('aria-disabled', 'true')

  await stroke(second)

  expect(painted(await savedProject(second))).toBe(0)
  await expect(second.getByTestId('project-surface')).toBeVisible()
  await expect(second.getByTestId('strip-undo')).toHaveAttribute('aria-disabled', 'true')
  await expect(second.getByTestId('announcer')).toHaveText("This Project is open in another tab. Changes made here aren't saved while it is open there.")

  await second.getByTestId('open-elsewhere-work-here').click()

  await expect(second.getByTestId('open-elsewhere')).toHaveCount(0)
  await expect(first.getByTestId('open-elsewhere-message')).toBeVisible()
  await expect(first.getByTestId('pill-tool-paint')).toHaveAttribute('aria-disabled', 'true')
  await stroke(second)
  await expect.poll(async () => painted(await savedProject(second))).toBe(6)
  await context.close()
})

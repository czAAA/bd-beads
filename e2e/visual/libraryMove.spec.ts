import { expect, test } from '@playwright/test'
import { gridBox, openApp, savedProject, setZoom, settle, storedProjects } from '../support/app'
import { beadCentre, fixtureProject, STORAGE_KEY, storedLibrary } from '../support/projects'
import { frameGrid } from '../../src/testUtils/frameGrid'
import type { Project } from '../../src/domain/project'

// The Project library moves to IndexedDB (spec 1018, ADR 0094): every check seeds the library through localStorage, so each
// one runs the copy; this one looks at it. The old key is left as seeded, and a stroke followed at once by closing the
// page is there on reopening.

const painted = (project: Project) => frameGrid(project).flat().filter((cell) => cell.color !== null).length

test('a library seeded in localStorage opens in the editor after the copy, the old key byte for byte as seeded, and a stroke followed at once by closing the page is there on reopening', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const project = fixtureProject({ technique: 'loom', blank: true })
  const seeded = storedLibrary([project])
  const page = await context.newPage()
  await openApp(page, [project])

  // Moved: the Project is a record, the flag is set, the old value is untouched.
  expect((await storedProjects(page)).map((stored) => stored.id)).toEqual([project.id])
  expect(await page.evaluate(() => localStorage.getItem('openbeads:library-in-indexeddb'))).toBe('1')
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(seeded)

  // A stroke, and the page closed the moment it ends.
  await setZoom(page, 100)
  const grid = await gridBox(page)
  const start = beadCentre({ technique: 'loom', rotation: 0 }, grid, 1, { row: 2, column: 1 })
  const end = beadCentre({ technique: 'loom', rotation: 0 }, grid, 1, { row: 2, column: 6 })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()
  // The stroke is on the Canvas (two frames), and not a moment more: the write it started has not been waited for.
  await settle(page)
  await page.close({ runBeforeUnload: true })

  const again = await context.newPage()
  await openApp(again, [project])
  await settle(again)
  expect(painted(await savedProject(again))).toBe(6)
  // Still not written: the old library is only a backup.
  expect(await again.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(seeded)
  expect(await again.evaluate(() => localStorage.getItem('openbeads:closing-note'))).toBeNull()
  await context.close()
})

import { expect, test, type Page } from '@playwright/test'
import { currentZoomPercent, openApp, setZoom, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// A reload opens the Project at the zoom and place it was left at (ticket 1108), and one left at its fit at the fit.

async function viewOf(page: Page) {
  const surface = page.getByTestId('project-surface')
  return {
    zoom: await currentZoomPercent(page),
    x: Number(await surface.getAttribute('data-scroll-x')),
    y: Number(await surface.getAttribute('data-scroll-y')),
  }
}

async function reload(page: Page): Promise<void> {
  await page.reload()
  await page.getByTestId('app-canvas').waitFor({ state: 'visible' })
  await settle(page)
}

test('a reload opens the Project where it was left, zoomed in and panned', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 30, rows: 20 })])
  await setZoom(page, 250)
  const surface = (await page.getByTestId('project-surface').boundingBox())!
  await page.mouse.move(surface.x + surface.width / 2, surface.y + surface.height / 2)
  await page.mouse.wheel(140, -90)
  await settle(page)
  const left = await viewOf(page)

  await reload(page)
  expect(await viewOf(page)).toEqual(left)
})

test('a reload of a Project at its fit opens it at its fit', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 30, rows: 20 })])
  const fit = await viewOf(page)
  await setZoom(page, 250)
  await page.getByTestId('zoom-reset').click()
  await settle(page)
  await reload(page)
  expect(await viewOf(page)).toEqual(fit)
})

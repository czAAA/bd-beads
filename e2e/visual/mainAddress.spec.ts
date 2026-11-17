import { expect, test, type Page } from '@playwright/test'
import { fixtureProject, STORAGE_KEY, storedLibrary } from '../support/projects'

// The main address (ticket 1052, ADR 0097): the Homepage's. A maker with Projects who opens it as a tab's first page
// lands in the editor at `app/`; later in that tab it stays the Homepage.

/** A device that has saved one Project and seen the storage note, before any page of the app has loaded. */
async function withAProject(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem('openbeads:storage-note-seen', 'yes')
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: STORAGE_KEY, value: storedLibrary([fixtureProject({ technique: 'loom', columns: 8, rows: 6 })]) },
  )
}

test('a newcomer sees the Homepage at the main address, and its way in opens the editor under app/', async ({ page, baseURL }) => {
  await page.goto('./')
  await expect(page.getByTestId('homepage-welcome')).toBeVisible()
  await expect(page).toHaveURL(baseURL!)

  await page.getByTestId('welcome-make-first').click()
  await expect(page.getByTestId('app-canvas')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe(new URL('app/', baseURL).pathname)
})

test('a maker with Projects lands in the editor from the main address, and the Wordmark leads back to a Homepage that stays', async ({ page, baseURL }) => {
  await withAProject(page)
  await page.goto('./')
  await expect(page.getByTestId('app-canvas')).toBeVisible()
  await expect(page).toHaveURL(new URL('app/', baseURL).href)

  await page.getByTestId('canvas-brand').click()
  await expect(page.getByTestId('homepage-welcome')).toBeVisible()
  await expect(page).toHaveURL(baseURL!)
  await page.reload()
  await expect(page.getByTestId('homepage-welcome')).toBeVisible()
})

test('the editor never sends a newcomer to the Homepage', async ({ page, baseURL }) => {
  await page.goto('./app/')
  await expect(page.getByTestId('app-canvas')).toBeAttached()
  await expect(page).toHaveURL(new URL('app/', baseURL).href)
})

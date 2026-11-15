import { expect, test, type Page } from '@playwright/test'
import { openApp, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// The notice about a Project that didn't open last time (ticket 0985): it comes up with the Menu open on the Projects
// library, and its buttons act on the first press, the panel's press outside leaving them alone (mouse and touch).

const IPAD = { width: 1366, height: 1024 }

/** Opens the app as a load that froze opening the Project leaves it: its opening note set before the first load. */
async function openAfterFrozenLoad(page: Page): Promise<void> {
  const project = fixtureProject({ technique: 'loom' })
  await page.addInitScript((note) => {
    if (sessionStorage.getItem('opening-note-set')) return
    sessionStorage.setItem('opening-note-set', '1')
    localStorage.setItem('openbeads:opening', note)
  }, JSON.stringify({ id: project.id, name: 'Loom' }))
  await openApp(page, [project])
  await page.getByTestId('missed-project').waitFor()
  await settle(page)
  await expect(page.getByTestId('panel-dropdown')).toBeVisible()
}

for (const device of ['mouse', 'touch'] as const) {
  test.describe(`with a ${device}`, () => {
    if (device === 'touch') test.use({ viewport: IPAD, hasTouch: true })
    const press = (page: Page, testId: string) => (device === 'touch' ? page.getByTestId(testId).tap() : page.getByTestId(testId).click())

    test('the first press on Save Project file saves the file', async ({ page }) => {
      await openAfterFrozenLoad(page)
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), press(page, 'missed-project-export')])
      expect(download.suggestedFilename()).toMatch(/\.openbeads$/)
    })

    test('the first press on Remove asks its question', async ({ page }) => {
      await openAfterFrozenLoad(page)
      await press(page, 'missed-project-remove')
      await expect(page.getByTestId('delete-project-modal')).toBeVisible()
    })
  })
}

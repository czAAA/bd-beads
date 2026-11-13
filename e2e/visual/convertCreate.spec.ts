import { expect, test, type Page } from '@playwright/test'
import { openApp, openNewProjectForm } from '../support/app'
import { fixturePicture } from '../support/picture'

// Create Project on screen from the first second (ticket 0897, ConvertImage card DS-1): from the Homepage a pattern is
// kept with the converter's one button, no step to pass; before a picture it is off with its reason, and with one it
// stands whole in the window under the result.

const choosePicture = (page: Page, name = 'tabby.png') =>
  page.getByTestId('convert-choose-file').setInputFiles({ name, mimeType: 'image/png', buffer: fixturePicture() })

test('from the Homepage a pattern is kept with Make your first Project, Convert image, Choose file and Create Project', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, [], './homepage/', { canvasHidden: true })
  await page.getByTestId('welcome-make-first').click()
  await page.getByTestId('project-surface').waitFor()
  // The first Project opens on the Canvas with no panel (ticket 0866), so Convert image is the Menu's row.
  await page.getByTestId('strip-menu').click()
  await page.getByTestId('menu-convert-image').click()
  await choosePicture(page)
  await page.getByTestId('convert-image-create').click()

  await expect(page.getByTestId('convert-image-wizard')).toHaveCount(0)
  await expect(page.getByTestId('project-surface')).toBeVisible()
  // Opened with no form, the Project is named after the file.
  await page.getByTestId('strip-project').click()
  await expect(page.getByTestId('project-panel')).toContainText('tabby')
})

test('the New Project form’s Name and Maker’s name are the Project’s, asked nowhere on the converter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, [])
  await openNewProjectForm(page)
  await page.locator('#new-project-form [data-testid="name-input"]').fill('Spring bracelet')
  await page.locator('#new-project-form [data-testid="maker-name-input"]').fill('Olga')
  await page.getByTestId('convert-image').click()
  await expect(page.getByTestId('convert-image-wizard').locator('input:not([type="file"]):not([type="range"])')).toHaveCount(0)
  await choosePicture(page)
  await expect(page.getByTestId('convert-project-line')).toHaveText('project Spring bracelet')
  await page.getByTestId('convert-image-create').click()
  await expect(page.getByTestId('convert-image-wizard')).toHaveCount(0)
  await page.getByTestId('strip-project').click()
  await expect(page.getByTestId('project-panel')).toContainText('Spring bracelet')
  await expect(page.getByTestId('project-panel')).toContainText('Olga')
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1180, height: 820 },
]) {
  test(`Create Project is off with its reason, then on and whole under the result at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openApp(page, [])
    await openNewProjectForm(page)
    await page.getByTestId('convert-image').click()

    const button = page.getByTestId('convert-image-create')
    await expect(button).toBeVisible()
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('convert-result-none')).toHaveText('no picture yet')
    await button.hover()
    await expect(page.getByTestId('tooltip').filter({ visible: true })).toHaveText(/Create Project\s*Add a picture first\./)
    await page.mouse.move(2, 2)

    await choosePicture(page)
    await expect(button).not.toHaveAttribute('aria-disabled')
    const result = (await page.getByTestId('convert-result').boundingBox())!
    const box = (await button.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    expect(box.y - (result.y + result.height)).toBeLessThanOrEqual(16)
    await expect(page.getByTestId('convert-result-size')).toContainText(/\d+×\d+ beads · /)
    await expect(page.getByTestId('convert-result-beads')).toContainText(/^beads needed [\d\s\u202f]+ · ≈ [\d.]+ g$/)
  })
}

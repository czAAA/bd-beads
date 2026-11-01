import { expect, test, type Page } from '@playwright/test'
import { chooseNewProjectTechnique, convertPicture, openApp, openNewProjectForm, setConvertWidth, showConvertStep } from '../support/app'
import { fixturePicture } from '../support/picture'

// The Convert image page (spec 0645, tickets 0747, 0756): the preview in each Technique at a Width on a mark, then A part
// with its handles and the rest dimmed (as the framing step's check was, ticket 58), and each layout: the preview beside
// the step from 1024 px in landscape, above it on a phone. The tolerance covers anti-aliasing.

async function openPage(page: Page, technique?: string) {
  await openApp(page, [])
  await openNewProjectForm(page)
  if (technique) await chooseNewProjectTechnique(page, technique)
  await convertPicture(page, fixturePicture())
  // Out of the way of the beads, so no hover ring or cursor shows.
  await page.mouse.move(2, 2)
}

test.describe('Convert image preview', () => {
  for (const technique of ['loom', 'peyote', 'brick'] as const) {
    test(technique, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 860 })
      await openPage(page, technique)
      const preview = page.getByTestId('convert-image-box')
      const shot = (name: string) =>
        expect.soft(preview, name).toHaveScreenshot(`convert-${technique}-${name}.png`, { maxDiffPixelRatio: 0.008 })

      // The 240 px wide fixture on its 8 × 8 px mark: 30 × 20 beads, exact.
      await setConvertWidth(page, 30)
      await expect(page.getByTestId('convert-result')).toContainText('30×20')
      await shot('whole')

      // A part starts 10% in from each edge, the rest of the picture dimmed round it.
      await showConvertStep(page, 'picture')
      await page.getByTestId('convert-weave').locator('[data-value="part"]').click()
      await expect(page.getByTestId('convert-crop-topLeft')).toBeVisible()
      await page.mouse.move(2, 2)
      await shot('part')

      // The top-left handle moved 30 px right and down, ten per Shift + arrow.
      await page.getByTestId('convert-crop-topLeft').focus()
      for (let step = 0; step < 3; step += 1) await page.keyboard.press('Shift+ArrowRight')
      for (let step = 0; step < 3; step += 1) await page.keyboard.press('Shift+ArrowDown')
      await page.mouse.move(2, 2)
      await shot('part-moved')
    })
  }
})

test.describe('Convert image layouts', () => {
  for (const viewport of [
    { width: 1280, height: 860 },
    { width: 1024, height: 768 },
  ]) {
    test(`the preview beside the step at ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await openPage(page)
      const wizard = page.getByTestId('convert-image-wizard')
      const preview = (await page.locator('.convert-page__preview').boundingBox())!
      const step = (await page.locator('.convert-page__step').boundingBox())!

      expect(preview.x + preview.width).toBeLessThanOrEqual(step.x + 1)
      expect(Math.abs(preview.y - step.y)).toBeLessThan(1)
      // The page fills the canvas box between the strip and the Progress bar, edge to edge.
      const box = (await page.getByTestId('app-canvas').boundingBox())!
      const own = (await wizard.boundingBox())!
      expect(Math.abs(own.width - box.width)).toBeLessThan(2)
      if (viewport.width === 1280) await expect.soft(wizard).toHaveScreenshot('convert-page-desktop.png', { maxDiffPixelRatio: 0.01 })
    })
  }

  test('the preview above the step, which scrolls on its own, on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openPage(page)
    const wizard = page.getByTestId('convert-image-wizard')
    const preview = (await page.locator('.convert-page__preview').boundingBox())!
    const step = (await page.locator('.convert-page__step').boundingBox())!

    expect(preview.y + preview.height).toBeLessThanOrEqual(step.y + 1)
    expect(preview.height).toBeLessThanOrEqual(301)
    await expect.soft(wizard).toHaveScreenshot('convert-page-phone.png', { maxDiffPixelRatio: 0.01 })

    await showConvertStep(page, 'colors')
    await page.locator('.convert-page__step').evaluate((scroller) => scroller.scrollTo({ top: 900 }))
    const after = (await page.locator('.convert-page__preview').boundingBox())!
    expect(after).toEqual(preview)
  })
})

import { expect, test, type Page } from '@playwright/test'
import { chooseNewProjectTechnique, convertPicture, openApp, openNewProjectForm, setConvertWidth } from '../support/app'
import { fixturePicture } from '../support/picture'

// The Convert image wizard (spec 0645, ticket 0747): the preview in each Technique at a Width on a mark, then A part
// with its handles and the rest dimmed (as the framing step's check was, ticket 58), and each layout: two panes from
// 1024 px in landscape, one long scroll under a sticky, shrinking preview on a phone. The tolerance covers anti-aliasing.

async function openWizard(page: Page, technique?: string) {
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
      await openWizard(page, technique)
      const preview = page.getByTestId('convert-image-box')
      const shot = (name: string) =>
        expect.soft(preview, name).toHaveScreenshot(`convert-${technique}-${name}.png`, { maxDiffPixelRatio: 0.008 })

      // The 240 px wide fixture on its 8 × 8 px mark: 30 × 20 beads, exact.
      await setConvertWidth(page, 30)
      await expect(page.getByTestId('convert-result')).toContainText('30×20')
      await shot('whole')

      // A part starts 10% in from each edge, the rest of the picture dimmed round it.
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
    test(`two panes at ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await openWizard(page)
      const dialog = page.getByTestId('convert-image-wizard')
      const preview = (await page.locator('.convert-wizard__preview-pane').boundingBox())!
      const sections = (await page.locator('.convert-wizard__sections').boundingBox())!

      expect(preview.x + preview.width).toBeLessThanOrEqual(sections.x + 1)
      expect(Math.abs(preview.y - sections.y)).toBeLessThan(1)
      // Never more than the viewport less 24 a side (Modal card), centred.
      const box = (await dialog.boundingBox())!
      expect(box.width).toBeLessThanOrEqual(viewport.width - 48 + 1)
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2)
      if (viewport.width === 1280) await expect.soft(dialog).toHaveScreenshot('convert-wizard-desktop.png', { maxDiffPixelRatio: 0.01 })
    })
  }

  test('one long scroll with a sticky preview that shrinks, on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openWizard(page)
    const dialog = page.getByTestId('convert-image-wizard')
    const preview = page.locator('.convert-wizard__preview')
    const before = (await preview.boundingBox())!
    await expect.soft(dialog).toHaveScreenshot('convert-wizard-phone.png', { maxDiffPixelRatio: 0.01 })

    await page.locator('.convert-wizard').evaluate((scroller) => scroller.scrollTo({ top: 900 }))
    await expect(page.locator('.convert-wizard--shrunk')).toHaveCount(1)
    // The shrinking is a transform: wait for it to end before measuring.
    await page.waitForFunction(() => document.getAnimations().length === 0)
    const after = (await preview.boundingBox())!

    expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    expect(after.height).toBeLessThan(before.height * 0.6)
    const rail = (await page.locator('.convert-wizard__rail').boundingBox())!
    expect(rail.y).toBeGreaterThanOrEqual(after.y + after.height - 1)
    await expect.soft(dialog).toHaveScreenshot('convert-wizard-phone-scrolled.png', { maxDiffPixelRatio: 0.01 })
  })
})

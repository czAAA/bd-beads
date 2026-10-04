import { expect, test } from '@playwright/test'
import { openApp, setZoom } from '../support/app'
import { fixturePicture } from '../support/picture'

/**
 * The framing step of Convert image (ticket 58): the picture as beads under the Project's frame, at the picture's
 * 100% and 200% zoom and after being dragged to another part of it. The frame outline and its dimming are part of
 * what is compared. The beads are drawn on a canvas (ticket 104) at the preview's own fit-to-panel scale, which is
 * rarely a whole number, so the tolerance is the anti-aliasing of their edges against the reference (made from the one-element-per-bead preview they replaced): 0.8% of
 * the picture's pixels, where one bead is about 0.6%. What each bead is drawn in is pinned by the component's own tests.
 */
test.describe('Convert image framing', () => {
  for (const technique of ['loom', 'peyote', 'brick'] as const) {
    test(technique, async ({ page }) => {
      await openApp(page, [])
      await page.getByTestId('technique-select').locator(`[data-value="${technique}"]`).click()
      await page.getByTestId('width-input').fill('16')
      await page.getByTestId('height-input').fill('10')
      await page.getByTestId('convert-image-input').setInputFiles({
        name: 'fixture.png',
        mimeType: 'image/png',
        buffer: fixturePicture(),
      })
      const preview = page.getByTestId('convert-image-box')
      await preview.waitFor()

      const expectShot = async (name: string) => {
        await page.mouse.move(5, 5)
        await expect.soft(preview, name).toHaveScreenshot(`framing-${technique}-${name}.png`, { maxDiffPixelRatio: 0.008 })
      }

      await expectShot('zoom-100')

      await setZoom(page, 200)
      await expectShot('zoom-200')

      // Drag the picture up and to the left under the frame.
      const box = (await preview.boundingBox())!
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4, { steps: 8 })
      await page.mouse.up()
      await expectShot('zoom-200-dragged')
    })
  }
})

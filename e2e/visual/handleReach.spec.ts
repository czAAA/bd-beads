import { expect, test, type Page } from '@playwright/test'
import { convertPicture, openApp, openNewProjectForm } from '../support/app'
import { fixturePicture } from '../support/picture'

// Every resize handle is the one handle (Handle card, ticket 0867): the converter's crop handles answer a press within
// 14px of where they are drawn with a mouse, and within 22px, a 44px touch area, on an iPad (F-03-20, they answered on
// their 16px square alone).

const IPAD = { width: 1366, height: 1024 }

/** The crop with A part of the picture, and the top-left handle's point: the crop's corner it is drawn round. */
async function openCrop(page: Page): Promise<{ x: number; y: number }> {
  await openApp(page, [])
  await openNewProjectForm(page)
  await convertPicture(page, fixturePicture())
  await page.getByTestId('convert-weave').locator('[data-value="part"]').click()
  const box = (await page.getByTestId('convert-crop-topLeft').boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** The crop handle under a point of the page, if any. */
function handleAt(page: Page, point: { x: number; y: number }): Promise<string | undefined> {
  return page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid^="convert-crop-"]')?.getAttribute('data-testid') ?? undefined, point)
}

test.describe('the crop handles', () => {
  test.use({ viewport: IPAD })
  // The crop has no way in on the page between ticket 0896, which took A part of the picture away, and ticket 0898, which
  // stands the crop on the picture from the start; 0898 brings these back, opening the crop its own way.
  test.skip(true, 'The crop comes back on the picture with ticket 0898.')

  test('take a mouse within 14px of where they are drawn', async ({ page }) => {
    const corner = await openCrop(page)

    expect(await handleAt(page, { x: corner.x + 9, y: corner.y + 9 })).toBe('convert-crop-topLeft')
    expect(await handleAt(page, { x: corner.x - 13, y: corner.y })).toBe('convert-crop-topLeft')
    expect(await handleAt(page, { x: corner.x - 20, y: corner.y })).toBeUndefined()
  })

  test.describe('on touch', () => {
    test.use({ hasTouch: true, colorScheme: 'dark' })

    test('take a finger anywhere within 22px of where they are drawn', async ({ page }) => {
      const corner = await openCrop(page)
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)

      for (const [dx, dy] of [[-21, 0], [0, -21], [21, 0], [0, 21], [-14, -14]] as const) {
        expect(await handleAt(page, { x: corner.x + dx, y: corner.y + dy }), `${dx}, ${dy}`).toBe('convert-crop-topLeft')
      }
      expect(await handleAt(page, { x: corner.x - 26, y: corner.y })).toBeUndefined()
    })
  })
})

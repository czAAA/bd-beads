import { expect, test, type Page } from '@playwright/test'
import { chooseNewProjectTechnique, convertPicture, openApp, openConvertPopover, openNewProjectForm, setConvertWidth } from '../support/app'
import { fixturePicture } from '../support/picture'

// The Convert image page (spec 0645, tickets 0747, 0756, 0896): the preview in each Technique on a mark, then each layout:
// from 1024 px in landscape the beads beside a short column, at most a dozen controls and nothing under a fold (DS-1),
// the column under the preview on a phone; the crop on the picture from the start (ticket 0898).

async function openPage(page: Page, technique?: string) {
  await openApp(page, [])
  await openNewProjectForm(page)
  if (technique) await chooseNewProjectTechnique(page, technique)
  await convertPicture(page, fixturePicture())
  // Out of the way of the beads, so no hover ring or cursor shows.
  await page.mouse.move(2, 2)
}

/** The page's controls a person can reach before pressing anything (the strip's Menu and Close are outside the page):
 * every visible, focusable one, the crop's eight handles counted as one (DS-1), and whether each stands whole in the window. */
function firstWindow(page: Page) {
  return page.getByTestId('convert-image-wizard').evaluate((root) => {
    const controls = [...root.querySelectorAll<HTMLElement>('button, input, select, [tabindex]')].filter((element) => {
      if (element.tabIndex < 0 || element.closest('[hidden]')) return false
      const box = element.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'
    })
    const column = root.querySelector<HTMLElement>('[data-testid="convert-column"]')!
    const handles = controls.filter((element) => element.dataset.testid?.startsWith('convert-crop-'))
    return {
      count: controls.length - handles.length + (handles.length > 0 ? 1 : 0),
      handles: handles.length,
      names: controls.map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName),
      cut: controls.filter((element) => element.getBoundingClientRect().bottom > window.innerHeight + 0.5).map((element) => element.dataset.testid),
      columnScrolls: column.scrollHeight > column.clientHeight + 1,
    }
  })
}

test.describe('Convert image preview', () => {
  for (const technique of ['loom', 'peyote', 'brick'] as const) {
    test(technique, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 860 })
      await openPage(page, technique)
      // The 240 px wide fixture on its 8 × 8 px mark: 30 × 20 beads, exact.
      await setConvertWidth(page, 30)
      await expect(page.getByTestId('convert-result')).toContainText('30×20')
      await page.mouse.move(2, 2)
      await expect.soft(page.getByTestId('convert-image-box')).toHaveScreenshot(`convert-${technique}-whole.png`, { maxDiffPixelRatio: 0.008 })
    })
  }
})

test.describe('Convert image layouts', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1180, height: 820 },
  ]) {
    test(`a dozen controls at most and nothing under a fold at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await openPage(page)
      const shown = await firstWindow(page)
      expect(shown.count, shown.names.join(', ')).toBeLessThanOrEqual(12)
      expect(shown.handles).toBe(8)
      expect(shown.cut).toEqual([])
      expect(shown.columnScrolls).toBe(false)
      await expect(page.getByTestId('convert-bar')).toHaveCount(0)

      // The preview beside the column, both under the strip and down to the bottom of the window.
      const preview = (await page.locator('.convert-page__preview').boundingBox())!
      const column = (await page.getByTestId('convert-column').boundingBox())!
      expect(preview.x + preview.width).toBeLessThanOrEqual(column.x + 1)
      expect(Math.abs(preview.y - column.y)).toBeLessThan(1)
      expect(Math.abs(column.y + column.height - viewport.height)).toBeLessThan(2)
      if (viewport.width === 1440) await expect.soft(page.getByTestId('convert-image-wizard')).toHaveScreenshot('convert-page-desktop.png', { maxDiffPixelRatio: 0.01 })
    })
  }

  test('opens each setting’s more in a popover beside the column, over the preview, and Background’s over the bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openPage(page)
    const column = (await page.getByTestId('convert-column').boundingBox())!
    const preview = (await page.locator('.convert-page__preview').boundingBox())!

    for (const name of ['bead', 'size', 'colors'] as const) {
      await openConvertPopover(page, name)
      const popover = (await page.getByTestId(`convert-${name}-popover`).boundingBox())!
      // `space-12` apart: 12 at the root's 16px type, more where the root is larger (a desktop's).
      const gap = column.x - (popover.x + popover.width)
      expect([gap >= 12, gap <= 16], name).toEqual([true, true])
      expect(popover.y, name).toBeGreaterThanOrEqual(preview.y)
      expect(popover.y + popover.height, name).toBeLessThanOrEqual(preview.y + preview.height + 0.5)
      await page.keyboard.press('Escape')
      await expect(page.getByTestId(`convert-${name}-popover`)).toHaveCount(0)
    }

    await page.getByTestId('convert-tool-background').click()
    const popover = (await page.getByTestId('convert-background-popover').boundingBox())!
    const bar = (await page.getByTestId('convert-preview-tools').boundingBox())!
    expect(Math.abs(popover.x + popover.width / 2 - (bar.x + bar.width / 2))).toBeLessThan(2)
    expect(popover.y + popover.height).toBeLessThan(bar.y)
  })

  test('the column under the preview, scrolling on its own, on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openPage(page)
    const wizard = page.getByTestId('convert-image-wizard')
    const preview = (await page.locator('.convert-page__preview').boundingBox())!
    const column = (await page.getByTestId('convert-column').boundingBox())!

    expect(preview.y + preview.height).toBeLessThanOrEqual(column.y + 1)
    expect(preview.height).toBeLessThanOrEqual(301)
    await expect.soft(wizard).toHaveScreenshot('convert-page-phone.png', { maxDiffPixelRatio: 0.01 })

    // A popover opens in place under its button, in the column, and the preview stays where it was.
    await openConvertPopover(page, 'colors')
    await page.getByTestId('convert-column').evaluate((scroller) => scroller.scrollTo({ top: 900 }))
    expect(await page.locator('.convert-page__preview').boundingBox()).toEqual(preview)
  })
})

test.describe('Convert image crop (ticket 0898)', () => {
  test('opens on the whole picture, and a dragged corner keeps the part, read live and after', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openPage(page)
    await setConvertWidth(page, 30)
    await expect(page.getByTestId('convert-crop-line')).toHaveCount(0)
    const picture = (await page.getByTestId('convert-image-canvas').boundingBox())!
    const corner = (await page.getByTestId('convert-crop-bottomRight').boundingBox())!
    // At the whole picture's corner: nothing cropped in.
    expect(Math.abs(corner.x + corner.width / 2 - (picture.x + picture.width))).toBeLessThan(2)

    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
    await page.mouse.down()
    await page.mouse.move(corner.x + corner.width / 2 - picture.width / 2, corner.y + corner.height / 2 - picture.height / 2, { steps: 6 })
    await expect(page.getByTestId('convert-crop-size')).toContainText('15×10 beads')
    await page.mouse.up()
    await expect(page.getByTestId('convert-crop-size')).toHaveCount(0)
    await expect(page.getByTestId('convert-kept')).toContainText('keeping 15×10')
    await expect(page.getByTestId('convert-result')).toContainText('15×10 beads')
    await expect(page.getByTestId('convert-width-range')).toHaveAttribute('aria-valuenow', '15')

    await page.getByTestId('convert-keep-all').click()
    await expect(page.getByTestId('convert-kept')).toHaveCount(0)
    await expect(page.getByTestId('convert-result')).toContainText('30×20')
  })

  test.describe('on touch', () => {
    test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } })

    test('a finger on a handle drags it and never scrolls the page', async ({ page }) => {
      await openPage(page)
      await setConvertWidth(page, 30)
      const corner = (await page.getByTestId('convert-crop-bottomRight').boundingBox())!
      const x = corner.x + corner.width / 2
      const y = corner.y + corner.height / 2
      const scrolled = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')].some((element) => element.scrollTop > 0) || window.scrollY > 0)
      const cdp = await page.context().newCDPSession(page)
      const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', at: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: at })
      await touch('touchStart', [{ x, y }])
      for (let step = 1; step <= 6; step += 1) await touch('touchMove', [{ x: x - step * 20, y: y - step * 20 }])
      await touch('touchEnd', [])
      await expect(page.getByTestId('convert-kept')).toBeVisible()
      expect(await scrolled()).toBe(false)
    })
  })
})

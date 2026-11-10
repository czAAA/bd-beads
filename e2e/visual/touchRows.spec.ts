import { expect, test, type Page } from '@playwright/test'
import { convertPicture, openApp, openNewProjectForm, openStripPanel, settle } from '../support/app'
import { fixturePicture } from '../support/picture'
import { fixtureProject } from '../support/projects'

// On touch a row picks what was tapped (ticket 0836): on an iPad (a coarse pointer) every row of the converter's menus is
// at least 40 px tall and its own hit area (they were 23 px with overlapping 44 px ones, so a tap picked the row below),
// and the library's × answers over a 44 px square clear of the row's own button (the list's edge cut it).

const IPAD = { width: 1366, height: 1024 }
const TOUCH_TARGET = 44
const MIN_ROW = 40

/** The converter's menus on the Picture & bead step: the Bead section's Brand, Type and Size, then the Technique. */
const PICKERS = ['bead-brand', 'bead-type', 'bead-size', 'convert-technique'] as const

/** What the element at a point on the page is, as one of the given test ids or its own class. */
function hitAt(page: Page, point: { x: number; y: number }, testids: string[]): Promise<string> {
  return page.evaluate(
    ({ point, testids }) => {
      const element = document.elementFromPoint(point.x, point.y)
      const owner = testids.find((testid) => element?.closest(`[data-testid="${testid}"]`))
      if (owner) return owner
      const option = element?.closest<HTMLElement>('[role="menuitemradio"]')
      return option ? `option ${option.dataset.value}` : `${element?.getAttribute('class')}`
    },
    { point, testids },
  )
}

/** The Projects library, from Menu, holding one Project. */
async function openLibrary(page: Page): Promise<void> {
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await openStripPanel(page, 'strip-menu')
  await page.getByTestId('menu-saved-projects').click()
  await settle(page)
}

test.describe('on touch', () => {
  test.use({ viewport: IPAD, hasTouch: true, colorScheme: 'dark' })

  test("a tap on the middle of each row of the converter's menus picks that row", async ({ page }) => {
    await openApp(page, [])
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await openNewProjectForm(page)
    await convertPicture(page, fixturePicture())

    for (const picker of PICKERS) {
      const button = page.getByTestId(picker).locator('button[aria-haspopup]')
      const options = page.getByTestId(picker).locator('[role="menuitemradio"]')
      await button.tap()
      const count = await options.count()
      expect(count, picker).toBeGreaterThan(0)
      await page.keyboard.press('Escape')

      for (let index = 0; index < count; index += 1) {
        await button.tap()
        await settle(page)
        const option = options.nth(index)
        const value = (await option.getAttribute('data-value'))!
        const label = (await option.textContent())!.trim()
        const box = (await option.boundingBox())!
        expect(box.height, `${picker} ${value}`).toBeGreaterThanOrEqual(MIN_ROW)
        // The row's own hit area reaches its top and bottom edges, and no further: the rows touch.
        for (const y of [box.y + 1, box.y + box.height - 1]) {
          expect(await hitAt(page, { x: box.x + box.width / 2, y }, []), `${picker} ${value} at y ${y}`).toBe(`option ${value}`)
        }
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        await expect.poll(async () => (await button.getAttribute('aria-label'))?.endsWith(`: ${label}`), `${picker} ${value}`).toBe(true)
      }
    }
  })

  test("the library row's × answers over a 44 px square clear of the row's own", async ({ page }) => {
    await openLibrary(page)
    const row = page.getByTestId('project-item').first()
    const remove = row.locator('[data-testid^="remove-project-"]')
    const removeId = (await remove.getAttribute('data-testid'))!
    const selectId = (await row.locator('[data-testid^="select-project-"]').getAttribute('data-testid'))!
    const box = (await remove.boundingBox())!
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

    // The drawn × is still 14 px; the hit area is the square round it, every point of it the ×'s.
    expect((await remove.locator('svg').boundingBox())!.width).toBeLessThan(TOUCH_TARGET / 2)
    const half = TOUCH_TARGET / 2 - 1
    for (const dx of [-half, 0, half]) {
      for (const dy of [-half, 0, half]) {
        expect(await hitAt(page, { x: centre.x + dx, y: centre.y + dy }, [removeId, selectId]), `× at ${dx}, ${dy}`).toBe(removeId)
      }
    }
    // The row's own button stops before the × begins.
    const select = (await page.getByTestId(selectId).boundingBox())!
    expect(select.x + select.width).toBeLessThanOrEqual(centre.x - TOUCH_TARGET / 2)
  })
})

test.describe('with a mouse', () => {
  test.use({ viewport: IPAD })

  test("the library row's × is drawn as before, 20 px", async ({ page }) => {
    await openLibrary(page)
    const remove = page.getByTestId('project-item').first().locator('[data-testid^="remove-project-"]')
    const rootSize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize))
    const box = (await remove.boundingBox())!
    expect([box.width, box.height]).toEqual([1.25 * rootSize, 1.25 * rootSize])
  })
})

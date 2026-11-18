import { expect, test, type Page } from '@playwright/test'
import { openApp } from '../support/app'
import { fixtureProject } from '../support/projects'

// "Update ready" names what waits (ticket 1048, spec 1043): every state on the canvas's artboards, in light and dark,
// and Russian and Spanish on a phone. The waiting worker is a stand-in that answers with a fixture notes file numbered
// far above any Build's, so a new Release note never moves a reference.
type Kind = 'new' | 'changed' | 'fixed'
const note = (version: string, kind: Kind, line: string) => ({ name: `2099-01-01-${version.replaceAll('.', '')}`, version, date: '2099-01-01', kind, line })
const fileOf = (version: string, notes: ReturnType<typeof note>[]) => ({ version, releases: [], notes })

const STATES: [string, unknown][] = [
  ['one-new', fileOf('99.2.0', [note('99.2.0', 'new', "Zoomed in, the Frame's title block names its Bead with a Change button and counts the beads of each color")])],
  ['one-changed', fileOf('99.1.4', [note('99.1.4', 'changed', "A piece's ground and outline now reach a bead past its outer beads, with the grid showing there, so the places for its next beads are easy to see")])],
  ['one-fixed', fileOf('99.1.4', [note('99.1.4', 'fixed', 'On an iPad a big Frame of square beads no longer freezes the app')])],
  [
    'several',
    fileOf('99.3.1', [
      ...['99.3.1', '99.3.0', '99.2.3', '99.2.2', '99.2.1'].map((version) => note(version, 'fixed', 'A fix')),
      ...['99.2.0', '99.1.0'].map((version) => note(version, 'new', 'A new thing')),
      ...['99.0.3', '99.0.2', '99.0.1'].map((version) => note(version, 'changed', 'A change')),
    ]),
  ],
  ['several-no-new', fileOf('99.1.7', [note('99.1.7', 'fixed', 'A fix'), note('99.1.6', 'changed', 'A change'), note('99.1.5', 'fixed', 'A fix'), note('99.1.4', 'fixed', 'A fix')])],
  // No notes file: what an older worker, or no answer, leaves the toast to say.
  ['unknown', null],
]

/** Opens the editor with a newer Build waiting behind it, whose worker answers the page's question with `answer`. */
async function waitingWith(page: Page, answer: unknown, locale = 'en'): Promise<void> {
  await page.addInitScript(
    ({ answer, locale }) => {
      localStorage.setItem('openbeads:locale', locale)
      const worker = {
        state: 'installed',
        addEventListener() {},
        postMessage(message: { type?: string }, ports?: MessagePort[]) {
          if (message.type === 'NOTES') ports?.[0]?.postMessage(answer)
        },
      }
      const registration = { waiting: worker, installing: null, addEventListener() {}, update: () => Promise.resolve() }
      const container = { controller: {}, register: () => Promise.resolve(registration), addEventListener() {} }
      Object.defineProperty(Navigator.prototype, 'serviceWorker', { configurable: true, get: () => container })
    },
    { answer, locale },
  )
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 8, rows: 6, blank: true })])
  await expect(page.getByTestId('update-ready')).toBeVisible()
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Update ready in ${scheme} (ticket 1048)`, () => {
    test.use({ colorScheme: scheme })

    for (const [state, answer] of STATES) {
      test(state, async ({ page }) => {
        await waitingWith(page, answer)
        const toast = page.getByTestId('update-ready')
        await expect(toast.getByTestId('toast-second-action')).toHaveText("What's new")
        await expect(toast).toHaveScreenshot(`update-ready-${state}-${scheme}.png`, { maxDiffPixelRatio: 0.01 })
      })
    }
  })
}

/** The canvas's long lines, in its two languages. */
const LONG_LINES = {
  ru: 'Подложка и контур детали теперь выходят на бисеринку за её крайние бусины, и там видна сетка, так что места для следующих бусин легко увидеть',
  es: 'Un hueco pequeño dentro de una pieza ya no tiene contorno propio y muestra la cuadrícula, así es fácil rellenarlo; uno más grande conserva el contorno una cuenta más adentro',
}

test.describe('Update ready on a phone, in Russian and Spanish (ticket 1048)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const locale of ['ru', 'es'] as const) {
    test(locale, async ({ page }) => {
      await waitingWith(page, fileOf('99.1.4', [note('99.1.4', 'changed', LONG_LINES[locale])]), locale)
      const toast = page.getByTestId('update-ready')
      // The long line wraps inside the toast, and the toast inside the screen.
      const box = (await toast.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
      await expect(toast).toHaveScreenshot(`update-ready-phone-${locale}.png`, { maxDiffPixelRatio: 0.01 })
    })
  }
})

test('names the Version alone when no note waits above the page\'s (ticket 1048)', async ({ page }) => {
  await waitingWith(page, fileOf('99.0.0', []))
  const toast = page.getByTestId('update-ready')
  await expect(toast.getByTestId('update-version')).toHaveText('99.0.0')
  await expect(toast.getByTestId('kind-label')).toHaveCount(0)
})

/** A line as long as the canvas's longest, so ten rows make the toast as tall as real ones do. */
const LONG_CHANGE = 'The Rotate Canvas button shows the bead you weave with and its thread, turned with the Canvas, so you see which way the thread runs before you turn it'
/** 27 waiting, as on the canvas (ticket 1091): 3 New, 21 Changed and 3 Fixed, so the list holds 10 and 17 more wait. */
const MANY = fileOf(
  '99.9.26',
  Array.from({ length: 27 }, (_, index) => {
    const kind: Kind = index < 3 ? 'fixed' : index < 6 ? 'new' : 'changed'
    return note(`99.9.${26 - index}`, kind, `${kind === 'new' ? 'A new thing' : kind === 'fixed' ? 'A fix' : LONG_CHANGE} ${27 - index}`)
  }),
)
const SCHEMES = { light: { colorScheme: 'light' }, dark: { colorScheme: 'dark' }, contrast: { colorScheme: 'light', contrast: 'more' } } as const

test.describe("Update ready's list of what waits (ticket 1091)", () => {
  test('opens under the actions, keeping Reload in place, and closes again, leaving for nowhere', async ({ page }) => {
    await waitingWith(page, MANY)
    const toast = page.getByTestId('update-ready')
    const reload = toast.getByTestId('toast-action')
    const toggle = toast.getByTestId('toast-second-action')
    const before = (await reload.boundingBox())!
    const address = page.url()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toast.getByTestId('update-list').locator('li')).toHaveCount(10)
    await expect(toast.getByTestId('update-more')).toHaveText("17 more in What's new")
    // The toast grows to the left as it opens; Reload keeps its height in it.
    expect((await reload.boundingBox())!.y).toBe(before.y)
    expect(page.url()).toBe(address)
    await toggle.click()
    await expect(toast.getByTestId('update-list')).toHaveCount(0)
  })

  for (const [scheme, media] of Object.entries(SCHEMES)) {
    test(`open, in ${scheme}`, async ({ page }) => {
      await page.emulateMedia(media)
      await waitingWith(page, MANY)
      const toast = page.getByTestId('update-ready')
      await toast.getByTestId('toast-second-action').click()
      await expect(toast.getByTestId('update-list').locator('li')).toHaveCount(10)
      await expect(toast).toHaveScreenshot(`update-ready-open-${scheme}.png`, { maxDiffPixelRatio: 0.01 })
    })
  }

  for (const locale of ['ru', 'es'] as const) {
    test(`opens in ${locale}`, async ({ page }) => {
      await waitingWith(page, MANY, locale)
      const toast = page.getByTestId('update-ready')
      await toast.getByTestId('toast-second-action').click()
      await expect(toast.getByTestId('update-list').locator('li')).toHaveCount(10)
      await expect(toast).toHaveScreenshot(`update-ready-open-${locale}.png`, { maxDiffPixelRatio: 0.01 })
    })
  }

  test.describe('on a short screen, a tablet in landscape', () => {
    // An iPad's own scale: at 1× a browser can lay out what an iPad doesn't.
    test.use({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 })

    test('scrolls the list inside the toast, which stays inside the canvas box', async ({ page }) => {
      await waitingWith(page, MANY, 'ru')
      const toast = page.getByTestId('update-ready')
      await toast.getByTestId('toast-second-action').click()
      const list = toast.getByTestId('update-list')
      await expect(list.locator('li')).toHaveCount(10)
      const room = await page.getByTestId('toast-region').evaluate((region) => {
        const box = (region as HTMLElement).offsetParent!.getBoundingClientRect()
        const scroller = region.querySelector('[data-testid="update-list"]')!
        return { bottom: box.bottom, scrolls: scroller.scrollHeight > scroller.clientHeight + 1 }
      })
      const box = (await toast.boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(room.bottom)
      expect(room.scrolls).toBe(true)
      // The name, the actions and the link under the list stay in view.
      for (const part of [toast.getByTestId('update-version'), toast.getByTestId('toast-action'), toast.getByTestId('update-more')]) {
        const at = (await part.boundingBox())!
        expect(at.y).toBeGreaterThanOrEqual(box.y)
        expect(at.y + at.height).toBeLessThanOrEqual(box.y + box.height)
      }
    })
  })
})

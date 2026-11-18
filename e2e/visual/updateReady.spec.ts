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

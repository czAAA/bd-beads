import { expect, test, type Page } from '@playwright/test'
import { openApp } from '../support/app'

// What's new by Version (ticket 1047, spec 1043): closed, open, and at tablet width in Russian, in light and dark. The
// notes file is a fixture shaped like the canvas's, so a new Release note never moves a reference; the closed row's
// Version and date, which every Build changes, are masked.
const note = (name: string, version: string, kind: 'new' | 'changed' | 'fixed', en: string, ru: string) => ({ name, version, date: name.slice(0, 10), kind, en, ru })
const NOTES = [
  note('2026-12-04-0004', '2.1.3', 'fixed', 'On an iPad a big Frame or piece draws quickly at every zoom, even one full of gaps', 'На iPad большая рамка или кусочек быстро рисуется при любом масштабе'),
  note('2026-12-04-0003', '2.1.2', 'fixed', 'On an iPad a big Frame of square beads no longer freezes the app', 'На iPad большая рамка из квадратного бисера больше не подвешивает приложение'),
  note('2026-12-03-0002', '2.1.1', 'changed', 'A small gap inside a piece has no outline of its own and shows the grid, so it is easy to fill in', 'У небольшой пустоты внутри детали нет своего контура, в ней видна сетка, и её легко заполнить'),
  note('2026-12-02-0001', '2.1.0', 'new', 'Turn the Frame again and again without moving the pointer, and resize it while it lies turned', 'Поворачивайте рамку снова и снова, не сдвигая указатель, и меняйте её размер, пока она повёрнута'),
  note('2026-11-28-0010', '1.2.0', 'new', 'On the canvas the Mirror bar offers every axis count, and the mirror area grows to fit what you pick', 'На холсте панель отражения предлагает любое число осей, а область отражения сама увеличивается'),
  note('2026-11-27-0009', '1.1.2', 'fixed', 'With the Mirror on, Fill fills only where you tap it, so it no longer paints over the other strips', 'При включённом отражении заливка заливает только там, где вы нажали'),
  note('2026-11-26-0008', '1.1.1', 'changed', 'A refresh keeps the version you are on; a newer one arrives when you press Reload in Update ready', 'После обновления страницы версия остаётся прежней; новая приходит по кнопке «Перезагрузить»'),
  note('2026-11-25-0007', '1.1.0', 'new', 'On a phone, the Colors list of Convert image opens under the beads too', 'На телефоне список цветов в «Преобразовать изображение» тоже открывается под бисером'),
]
const fileIn = (locale: 'en' | 'ru') => ({
  version: '2.1.3',
  releases: [
    { version: '1.0.0', date: '2026-11-20' },
    { version: '2.0.0', date: '2026-12-01' },
  ],
  notes: NOTES.map(({ en, ru, ...rest }) => ({ ...rest, line: locale === 'ru' ? ru : en })),
})

/** What waits for Reload (ticket 1049): numbered far above any Build's, so a new Release note never moves a reference. */
const WAITING = [
  note('2099-01-02-0003', '99.2.1', 'fixed', 'On a big Frame Row done answers at once, as does every step along the Progress bar', 'На большой рамке «Ряд готов» срабатывает сразу, как и каждый шаг по полосе прогресса'),
  note('2099-01-02-0002', '99.2.0', 'new', "Zoomed in, the Frame's title block names its Bead with a Change button and counts the beads of each color", 'При увеличении штамп рамки называет её бисер, даёт кнопку «Изменить» и считает бисеринки каждого цвета'),
  note('2099-01-01-0001', '99.1.4', 'changed', "A piece's ground and outline now reach a bead past its outer beads, with the grid showing there", 'Подложка и контур детали теперь выходят на бисеринку за её крайние бусины, и там видна сетка'),
]

/** A newer Build waits behind the page: a stand-in worker that answers the page's question in the language asked. */
async function waitingBuild(page: Page): Promise<void> {
  const files = Object.fromEntries((['en', 'ru'] as const).map((locale) => [locale, { version: '99.2.1', releases: [], notes: WAITING.map(({ en, ru, ...rest }) => ({ ...rest, line: locale === 'ru' ? ru : en })) }]))
  await page.addInitScript((files) => {
    const worker = {
      state: 'installed',
      addEventListener() {},
      postMessage(message: { type?: string; locale?: string }, ports?: MessagePort[]) {
        if (message.type === 'NOTES') ports?.[0]?.postMessage(files[message.locale ?? 'en'])
      },
    }
    const registration = { waiting: worker, installing: null, addEventListener() {}, update: () => Promise.resolve() }
    const container = { controller: {}, register: () => Promise.resolve(registration), addEventListener() {} }
    Object.defineProperty(Navigator.prototype, 'serviceWorker', { configurable: true, get: () => container })
  }, files)
}

async function coffeeScreen(page: Page, locale: 'en' | 'ru', width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1400 })
  await page.route('**/notes/*.json', (route) => route.fulfill({ json: fileIn(route.request().url().endsWith('/ru.json') ? 'ru' : 'en') }))
  await page.addInitScript((shown) => localStorage.setItem('openbeads:locale', shown), locale)
  await openApp(page, [], './homepage/', { canvasHidden: true })
  await page.locator('[data-testid="section-step"][data-step="coffee"]').click()
  await expect(page.getByTestId('homepage-whats-new')).toBeVisible()
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`What's new in ${scheme} (ticket 1047)`, () => {
    test.use({ colorScheme: scheme })

    test('closed, then open', async ({ page }) => {
      await coffeeScreen(page, 'en', 1280)
      const fold = page.getByTestId('homepage-whats-new')
      const mask = [page.getByTestId('homepage-whats-new-latest')]
      await expect(fold).toHaveScreenshot(`whats-new-closed-${scheme}.png`, { mask, maxDiffPixelRatio: 0.01 })
      await page.getByTestId('homepage-whats-new-toggle').click()
      await expect(page.getByTestId('homepage-whats-new-release')).toHaveCount(2)
      await expect(fold).toHaveScreenshot(`whats-new-open-${scheme}.png`, { mask, maxDiffPixelRatio: 0.01 })
    })

    test('open at tablet width in Russian', async ({ page }) => {
      await coffeeScreen(page, 'ru', 820)
      await page.getByTestId('homepage-whats-new-toggle').click()
      await expect(page.getByTestId('homepage-whats-new-release').first()).toContainText('Выпуск 2.0.0')
      const fold = page.getByTestId('homepage-whats-new')
      await expect(fold).toHaveScreenshot(`whats-new-tablet-ru-${scheme}.png`, { mask: [page.getByTestId('homepage-whats-new-latest')], maxDiffPixelRatio: 0.01 })
    })

    test('open with a Build waiting for Reload (ticket 1049)', async ({ page }) => {
      await waitingBuild(page)
      await coffeeScreen(page, 'en', 1280)
      await page.getByTestId('homepage-whats-new-toggle').click()
      await expect(page.getByTestId('homepage-whats-new-waiting')).toContainText('99.2.1')
      const fold = page.getByTestId('homepage-whats-new')
      await expect(fold).toHaveScreenshot(`whats-new-waiting-${scheme}.png`, { mask: [page.getByTestId('homepage-whats-new-latest')], maxDiffPixelRatio: 0.01 })
    })

    test('open with a Build waiting, at tablet width in Russian (ticket 1049)', async ({ page }) => {
      await waitingBuild(page)
      await coffeeScreen(page, 'ru', 820)
      await page.getByTestId('homepage-whats-new-toggle').click()
      await expect(page.getByTestId('homepage-whats-new-waiting')).toContainText('Придёт после перезагрузки')
      const fold = page.getByTestId('homepage-whats-new')
      await expect(fold).toHaveScreenshot(`whats-new-waiting-tablet-ru-${scheme}.png`, { mask: [page.getByTestId('homepage-whats-new-latest')], maxDiffPixelRatio: 0.01 })
    })
  })
}

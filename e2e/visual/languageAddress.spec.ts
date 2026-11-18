import { expect, test, type Page } from '@playwright/test'
import { ru } from '../../src/i18n/ru'
import { uk } from '../../src/i18n/uk'
import { openStripPanel } from '../support/app'

// A language's code in the address (ticket 1053): `ru/` is the Homepage in Russian and `ru/app/` the editor, on a
// device that saved no language; the way in keeps the code, and the Menu's language switch changes it in place.

/** The address's path under the app's base path. */
const pathOf = (page: Page, baseURL: string) => new URL(page.url()).pathname.slice(new URL(baseURL).pathname.length)

/** Picks a language in the open Menu's switch. */
async function switchTo(page: Page, locale: string): Promise<void> {
  await page.locator('[data-testid="language-switcher"] button[aria-haspopup]').click()
  await page.locator(`[data-testid="language-switcher"] [role="menuitemradio"][data-value="${locale}"]`).click()
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
}

test('ru/ is the Russian Homepage on a new device, its way in opens the Russian editor at ru/app/, and the switch changes the code', async ({ page, baseURL }) => {
  await page.goto('./ru/')
  await expect(page.locator('#homepage-welcome')).toHaveText(ru.homepage.welcome.heading)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  expect(await page.evaluate(() => localStorage.getItem('openbeads:locale'))).toBe('ru')

  await page.getByTestId('welcome-make-first').click()
  await expect(page.getByTestId('app-canvas')).toBeVisible()
  expect(pathOf(page, baseURL!)).toBe('ru/app/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

  await openStripPanel(page, 'strip-menu')
  await switchTo(page, 'pl')
  expect(pathOf(page, baseURL!)).toBe('pl/app/')

  // The Wordmark leads back to the Homepage in the language now shown.
  await page.keyboard.press('Escape')
  await page.getByTestId('canvas-brand').click()
  await expect(page.getByTestId('homepage-welcome')).toBeVisible()
  expect(pathOf(page, baseURL!)).toBe('pl/')
})

test('an address with no code keeps the saved language and stays as it is when the language changes', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('openbeads:locale') === null) localStorage.setItem('openbeads:locale', 'uk')
  })
  await page.goto('./')
  await expect(page.locator('#homepage-welcome')).toHaveText(uk.homepage.welcome.heading)

  await openStripPanel(page, 'strip-menu')
  await switchTo(page, 'es')
  expect(pathOf(page, baseURL!)).toBe('')
})

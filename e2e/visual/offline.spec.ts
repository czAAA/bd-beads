import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { openApp } from '../support/app'
import { startHost, type Host } from '../support/hostProxy'
import { fixtureProject, STORAGE_KEY } from '../support/projects'
import { baseURL } from '../support/server'

/**
 * The offline shell in a real browser (ticket 69, ADR 0045): the production build served by `vite preview`, with its
 * service worker allowed to run (every other check blocks it). Our hosting is played by `startHost`, so it can be taken
 * down, slowed and given a new version of the worker.
 */
test.use({ serviceWorkers: 'allow' })

let host: Host
test.beforeEach(async () => {
  host = await startHost(baseURL)
})
test.afterEach(async () => {
  await host.close()
})

/** Opens the editor from `host` on a saved Project, and waits until the worker has the whole app and is in control. */
async function openAndInstall(page: Page): Promise<void> {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 8, rows: 6, blank: true })], host.url)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
}

const savedNames = (page: Page) =>
  page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? '{"patterns":[]}') as { patterns: { name: string }[] }).patterns.map((p) => p.name), STORAGE_KEY)

/** Reloads, and expects the app itself (not the browser's error page) with the Project that was open. */
async function reloadsIntoTheApp(page: Page): Promise<void> {
  await page.reload()
  await expect(page.getByTestId('app-canvas')).toBeVisible()
}

/** Creates a Pattern through the New Pattern form, paints a bead, saves, and checks it is stored. */
async function createEditAndSave(page: Page, name: string): Promise<void> {
  await page.getByTestId('new-project-button').click()
  await page.getByTestId('name-input').fill(name)
  await page.locator('form.new-project-form button[type=submit]').click()
  await expect(page.getByTestId('project-surface')).toBeVisible()
  const surface = page.getByTestId('project-surface')
  const box = (await surface.boundingBox())!
  await page.mouse.click(box.x + 20, box.y + 20)
  await page.getByTestId('save-button').click()
  await expect.poll(() => savedNames(page)).toContain(name)
}

const failures: [string, (context: BrowserContext, host: Host) => Promise<void>][] = [
  ['with no network', (context) => context.setOffline(true)],
  ['with our hosting answering 503 (the API included)', async (_context, hosting) => void (hosting.down = true)],
]

for (const [situation, breakIt] of failures) {
  test(`the app opens and works ${situation}`, async ({ page, context }) => {
    await openAndInstall(page)
    await breakIt(context, host)

    await reloadsIntoTheApp(page)
    await createEditAndSave(page, 'Made offline')
    await reloadsIntoTheApp(page)
    expect(await savedNames(page)).toContain('Made offline')
    await expect(page.getByTestId('save-state')).toBeVisible()
  })

  test(`the Overview opens ${situation}`, async ({ page, context }) => {
    await openAndInstall(page)
    await breakIt(context, host)

    await page.goto(new URL('overview/', host.url).href)
    await expect(page.locator('main, #app').first()).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
}

test('is installable: a manifest with icons, standalone, and no installability error', async ({ page, context }) => {
  await openAndInstall(page)
  const cdp = await context.newCDPSession(page)
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] }
  expect(installabilityErrors).toEqual([])
  const manifest = (await (await page.request.get(new URL('manifest.webmanifest', host.url).href)).json()) as { display: string }
  expect(manifest.display).toBe('standalone')
})

test('asks the browser to keep the library', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { persistAsked: number }).persistAsked = 0
    navigator.storage.persist = () => {
      ;(window as unknown as { persistAsked: number }).persistAsked += 1
      return Promise.resolve(true)
    }
  })
  await openAndInstall(page)
  await expect.poll(() => page.evaluate(() => (window as unknown as { persistAsked: number }).persistAsked)).toBeGreaterThan(0)
})

test.describe('a new version', () => {
  /** What the next worker looks like to the browser: another cache name, so it is a different build. */
  const newVersion = (path: string, text: string) => (path.endsWith('/sw.js') ? text.replace('"bd-beads-', '"bd-beads-next-') : text)

  const cacheNames = (page: Page) => page.evaluate(() => caches.keys())

  test('waits for the person: an Update ready toast, and Reload switches over', async ({ page }) => {
    await openAndInstall(page)
    const before = await cacheNames(page)
    expect(before).toHaveLength(1)

    host.rewrite = newVersion
    await page.evaluate(async () => void (await (await navigator.serviceWorker.getRegistration())!.update()))

    await expect(page.getByTestId('update-ready')).toContainText('Update ready')
    // Not forced: the old version is still the one in control until Reload is pressed.
    expect(await cacheNames(page)).toHaveLength(2)
    await page.getByTestId('toast-action').click()
    await expect(page.getByTestId('app-canvas')).toBeVisible()
    await expect.poll(() => cacheNames(page)).toEqual([expect.stringContaining('bd-beads-next-')])
  })

  test('arrives on its own when the app is opened again', async ({ page, context }) => {
    await openAndInstall(page)
    host.rewrite = newVersion
    await page.evaluate(async () => void (await (await navigator.serviceWorker.getRegistration())!.update()))
    await expect(page.getByTestId('update-ready')).toBeVisible()

    await page.close()
    const again = await context.newPage()
    await again.goto(host.url)
    await expect(again.getByTestId('app-canvas')).toBeVisible()
    await expect.poll(() => cacheNames(again)).toEqual([expect.stringContaining('bd-beads-next-')])
  })
})

test.describe('the splash', () => {
  test.beforeEach(() => {
    // The code takes a while to arrive, which is when the splash is for.
    host.delay = { pattern: /\/assets\/main-.*\.js/, ms: 2500 }
  })
  test.use({ serviceWorkers: 'block', reducedMotion: 'no-preference' })

  async function openSlowly(page: Page): Promise<void> {
    await page.addInitScript(() => sessionStorage.setItem('bd-beads:editor-chosen', '1'))
    await page.goto(host.url, { waitUntil: 'commit' })
  }

  test('shows three beads in the accent colour after a moment, and is gone once the app is up', async ({ page }) => {
    await openSlowly(page)
    const beads = page.locator('#splash i')
    await expect(beads).toHaveCount(3)
    // Hidden until the loading delay (300ms) has passed, then shown.
    await expect(page.locator('#splash')).toHaveCSS('animation-delay', '0.3s')
    await expect(page.locator('#splash')).toHaveCSS('opacity', '1')
    await expect(beads.first()).toHaveCSS('background-color', 'rgb(250, 82, 15)')
    await expect(page.getByTestId('app-canvas')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('#splash')).toHaveCount(0)
  })

  test.describe('in the dark theme', () => {
    test.use({ colorScheme: 'dark' })
    test('is on the dark background with yellow beads', async ({ page }) => {
      await openSlowly(page)
      await expect(page.locator('#splash')).toHaveCSS('opacity', '1')
      await expect(page.locator('#splash')).toHaveCSS('background-color', 'rgb(26, 26, 26)')
      await expect(page.locator('#splash i').first()).toHaveCSS('background-color', 'rgb(250, 255, 105)')
    })
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })
    test('the beads stand still', async ({ page }) => {
      await openSlowly(page)
      await expect(page.locator('#splash')).toHaveCSS('opacity', '1')
      await expect(page.locator('#splash i').first()).toHaveCSS('animation-name', 'none')
    })
  })

  test('does not show at all when the app is quick', async ({ page }) => {
    host.delay = null
    await page.goto(host.url)
    await expect(page.locator('#splash')).toHaveCount(0)
  })
})

import { expect, test, type BrowserContext, type Page, type Response } from '@playwright/test'
import { openApp, openStripPanel, storedProjects } from '../support/app'
import { startHost, type Host } from '../support/hostProxy'
import { fixtureProject } from '../support/projects'
import { baseURL } from '../support/server'

// The offline shell in a real browser (ticket 69, ADR 0045): the production build under `vite preview` with its service
// worker allowed (other checks block it); `startHost` plays our hosting, so it can go down, slow, or serve a new
// worker.
test.use({ serviceWorkers: 'allow' })

let host: Host
test.beforeEach(async () => {
  host = await startHost(baseURL)
})
test.afterEach(async () => {
  await host.close()
})

/** Opens the editor from `host` on a saved Project, and waits until the worker has the whole app and is in control. */
async function openAndInstall(page: Page, storageNote = false): Promise<void> {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 8, rows: 6, blank: true })], host.url, { storageNote })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
}

/** The app's own question to the host, whose redirect to another origin means the sign-in has run out (ticket 1041). */
const askedForSignIn = (response: Response) => response.url().endsWith('/sw.js') && response.request().method() === 'HEAD'

const savedNames = async (page: Page) => (await storedProjects(page)).map((project) => project.layers[0]!.name)

/** Reloads, and expects the app itself (not the browser's error page) with the Project that was open. */
async function reloadsIntoTheApp(page: Page): Promise<void> {
  await page.reload()
  await expect(page.getByTestId('app-canvas')).toBeVisible()
}

/** Creates a Project through the New Project form, paints a bead, saves, and checks it is stored. New Project and Save
 * both sit in the Dock's Project panel, which creating the Project closes. */
async function createEditAndSave(page: Page, name: string): Promise<void> {
  await openStripPanel(page, 'strip-menu')
  // With an empty library Menu already opens on the form.
  if (!(await page.getByTestId('name-input').isVisible())) await page.getByTestId('menu-new-project').click()
  await page.getByTestId('name-input').fill(name)
  await page.locator('[data-testid=create-project]').click()
  await expect(page.getByTestId('project-surface')).toBeVisible()
  const surface = page.getByTestId('project-surface')
  const box = (await surface.boundingBox())!
  await page.mouse.click(box.x + 20, box.y + 20)
  await expect.poll(() => savedNames(page)).toContain(name)
}

/** The line of the one note the next version brings (ticket 1048). */
const NEXT_LINE = 'The next version brings this'
/** The Version after `version`, as a New note steps it. */
const nextOf = (version: string) => version.replace(/^(\d+)\.(\d+)\.\d+$/, (_, major: string, minor: string) => `${major}.${Number(minor) + 1}.0`)

/** The next Build's notes file: one Version up, with one more note, New. */
function nextNotes(text: string): string {
  const file = JSON.parse(text) as { version: string; notes: unknown[] }
  const version = nextOf(file.version)
  return JSON.stringify({ ...file, version, notes: [{ name: '2099-01-01-9999', version, date: '2099-01-01', kind: 'new', line: NEXT_LINE }, ...file.notes] })
}

/** A Build with the page's own Version: only its worker differs, with another cache name, and its pages carry a mark. */
function sameVersion(path: string, text: string): string {
  if (path.endsWith('/sw.js')) return text.replace('"bd-beads-', '"bd-beads-next-')
  return text.replace('<head>', '<head><meta name="next-version">')
}

/** What the next version looks like to the browser: a different Build, as `sameVersion`, whose notes files bring one
 * more note under the next Version. */
function newVersion(path: string, text: string): string {
  return /\/notes\/[a-z]+\.json/.test(path) ? nextNotes(text) : sameVersion(path, text)
}

/** The page's own Version, from its notes file. */
async function pageVersion(page: Page): Promise<string> {
  return ((await (await page.request.get(new URL('notes/en.json', host.url).href)).json()) as { version: string }).version
}

/** Has the browser look for a newer worker, as a tab brought back does. */
const lookForUpdate = (page: Page) => page.evaluate(async () => void (await (await navigator.serviceWorker.getRegistration())!.update()))

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
    await openStripPanel(page, 'strip-project')
    await expect(page.getByTestId('save-state')).toBeVisible()
  })

  test(`switches to a language it has not shown yet ${situation} (ticket 0616)`, async ({ page, context }) => {
    await openAndInstall(page)
    await breakIt(context, host)

    await reloadsIntoTheApp(page)
    await openStripPanel(page, 'strip-menu')
    await page.locator('[data-testid="language-switcher"] button[aria-haspopup]').click()
    await page.locator('[data-testid="language-switcher"] [role="menuitemradio"][data-value="ru"]').click()
    // The language changes only once its strings have arrived, from the offline copy here.
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })

  test(`the Homepage opens ${situation}`, async ({ page, context }) => {
    await openAndInstall(page)
    await breakIt(context, host)

    await page.goto(new URL('homepage/', host.url).href)
    await expect(page.getByTestId('homepage')).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  // The notes files are built files (ticket 1047): What's new reads the page's own, in a language not shown before.
  test(`What's new opens ${situation}, in a language the device has not shown (ticket 1047)`, async ({ page, context }) => {
    await openAndInstall(page)
    await breakIt(context, host)

    await page.addInitScript(() => localStorage.setItem('openbeads:locale', 'es'))
    await page.goto(new URL('homepage/', host.url).href)
    await page.locator('[data-testid="section-step"][data-step="coffee"]').click()
    await page.getByTestId('homepage-whats-new-toggle').click()
    await expect(page.getByTestId('homepage-whats-new-release').last()).toContainText('Lanzamiento 1.0.0')
    await expect(page.getByTestId('homepage-history')).toHaveText('Todos los cambios')
  })

  // The demo editor and the print code come after the page (ticket 0991), from the offline copy like every other file.
  test(`What's inside plays its demo ${situation} (ticket 0991)`, async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openAndInstall(page)
    await breakIt(context, host)

    await page.goto(new URL('homepage/', host.url).href)
    await page.locator('[data-testid="section-step"][data-step="inside"]').click()
    await expect(page.getByTestId('inside-editor')).toBeVisible()
    await expect(page.getByTestId('inside-editor').getByTestId('project-surface')).toBeVisible()
  })

  test(`exports a PDF ${situation} (ticket 0991)`, async ({ page, context }) => {
    await openAndInstall(page)
    await breakIt(context, host)

    await reloadsIntoTheApp(page)
    await openStripPanel(page, 'strip-frame')
    await page.locator('[data-testid="frame-export"] .panel-section__header').click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-pdf').click()])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })
}

// Cloudflare answers `/index.html` with a redirect to `/` (the test hosting does too), and a browser refuses a redirected
// response as the answer to a page load (ticket 1017).
test('keeps no redirected copy of a page, so the copy on the device can open', async ({ page }) => {
  await openAndInstall(page)
  const kept = await page.evaluate(async () => {
    const cache = await caches.open((await caches.keys())[0]!)
    const copy = await cache.match(new URL('index.html', document.baseURI).href)
    return copy ? { redirected: copy.redirected, text: await copy.text() } : null
  })
  expect(kept).not.toBeNull()
  expect(kept!.redirected).toBe(false)
  expect(kept!.text).toContain('<div id="app">')
})

// A page the device holds comes from the device, whatever the host does (ticket 1041): no wait for a slow answer.
test('opens a page from the device at once while the host is slow', async ({ page }) => {
  await openAndInstall(page)
  host.delay = { pattern: /./, ms: 20_000 }

  await page.reload()
  await expect(page.getByTestId('app-canvas')).toBeVisible({ timeout: 4000 })
})

test('takes a page the device has no copy of from the network', async ({ page }) => {
  await openAndInstall(page)
  const dropped = await page.evaluate(async () => {
    const cache = await caches.open((await caches.keys())[0]!)
    return cache.delete(new URL('index.html', document.baseURI).href)
  })
  expect(dropped).toBe(true)

  // The host's page carries a mark the copy on the device never had.
  host.rewrite = (_path, text) => text.replace('<head>', '<head><meta name="from-host">')
  await reloadsIntoTheApp(page)
  await expect(page.locator('meta[name="from-host"]')).toHaveCount(1)
})

// Cloudflare Access sends a request without a session to its sign-in page. A page from the device never meets it, so
// the app notices and offers the way back (ticket 1041, reversing ticket 1017's rule).
test.describe('once the Access sign-in has run out', () => {
  /** The address Access returns to after signing in: the one Sign in asked for. */
  const afterSignIn = () => `${host.url}?sign-in=`

  /** Presses Sign in, meets the sign-in page, and comes back signed in, as Access returns to the address asked for. */
  async function signIn(page: Page): Promise<void> {
    await page.getByTestId('sign-in').getByTestId('toast-action').click()
    await expect(page.getByRole('heading', { name: host.signInText })).toBeVisible()
    host.accessExpired = false
    await page.goto(afterSignIn())
    await expect(page.getByTestId('app-canvas')).toBeVisible()
  }

  test('the app opens from the device and offers Sign in, which keeps the library', async ({ page }) => {
    await openAndInstall(page)
    host.accessExpired = true

    await reloadsIntoTheApp(page)
    await expect(page.getByTestId('sign-in')).toContainText('Your sign-in has run out.')

    const askedAgain = page.waitForResponse((response) => askedForSignIn(response) && response.ok())
    await signIn(page)
    expect(await savedNames(page)).toContain('Fixture loom')
    // Signed in: nothing to offer, and the address is the app's own again.
    await expect(page).toHaveURL(host.url)
    await askedAgain
    await expect(page.getByTestId('sign-in')).toHaveCount(0)
  })

  test('a newer version published meanwhile is found after signing in', async ({ page }) => {
    await openAndInstall(page)
    host.accessExpired = true
    host.rewrite = newVersion
    await reloadsIntoTheApp(page)
    await expect(page.getByTestId('sign-in')).toBeVisible()
    await expect(page.getByTestId('update-ready')).toHaveCount(0)

    await signIn(page)
    await expect(page.getByTestId('update-ready')).toBeVisible()
    // Signing in went through the host, and still opened the version the device holds.
    await expect(page.locator('meta[name="next-version"]')).toHaveCount(0)
  })
})

test('offers no Sign in with no network', async ({ page, context }) => {
  await openAndInstall(page)
  host.accessExpired = true
  await context.setOffline(true)

  await reloadsIntoTheApp(page)
  // Offline nothing is asked; the wait is for a toast that would have come.
  await page.waitForTimeout(1000)
  await expect(page.getByTestId('sign-in')).toHaveCount(0)
})

test('offers no Sign in on a host that asks for none', async ({ page }) => {
  await openAndInstall(page)

  const asked = page.waitForResponse(askedForSignIn)
  await reloadsIntoTheApp(page)
  await asked
  await expect(page.getByTestId('sign-in')).toHaveCount(0)
})

test('is installable: a manifest with icons, standalone, and no installability error', async ({ page, context }) => {
  await openAndInstall(page)
  const cdp = await context.newCDPSession(page)
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] }
  expect(installabilityErrors).toEqual([])
  const manifest = (await (await page.request.get(new URL('manifest.webmanifest', host.url).href)).json()) as { display: string }
  expect(manifest.display).toBe('standalone')
})

test('asks the browser to keep the library at the first Project file, not on load or on creating, with no dialog, and says its yes', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { persistAsked: number }).persistAsked = 0
    // The download route, so the Project file reaches the device with no file picker (ADR 0090).
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
    navigator.storage.persisted = () => Promise.resolve(false)
    navigator.storage.persist = () => {
      ;(window as unknown as { persistAsked: number }).persistAsked += 1
      return Promise.resolve(true)
    }
  })
  const asked = () => page.evaluate(() => (window as unknown as { persistAsked: number }).persistAsked)
  await openAndInstall(page, true)
  expect(await asked()).toBe(0)

  await openStripPanel(page, 'strip-menu')
  // With an empty library Menu already opens on the form.
  if (!(await page.getByTestId('name-input').isVisible())) await page.getByTestId('menu-new-project').click()
  await page.getByTestId('name-input').fill('First save')
  await page.locator('[data-testid=create-project]').click()
  await expect(page.getByTestId('project-surface')).toBeVisible()
  expect(await asked()).toBe(0)

  await openStripPanel(page, 'strip-project')
  // This Project starts folded (ticket 0971).
  await page.locator('[data-testid="project-this"] .panel-section__header').click()
  await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project-file').click()])
  await expect.poll(asked).toBe(1)
  await expect(page.locator('.app-modal')).toHaveCount(0)
  await expect(page.getByText('This browser will keep your Projects.')).toBeVisible()
})

test.describe('a new version', () => {
  const cacheNames = (page: Page) => page.evaluate(() => caches.keys())

  test('waits for the person: Update ready names the Version and its note, and Reload switches over (ticket 1048)', async ({ page }) => {
    await openAndInstall(page)
    const before = await cacheNames(page)
    expect(before).toHaveLength(1)
    const next = nextOf(await pageVersion(page))

    host.rewrite = newVersion
    await lookForUpdate(page)

    const toast = page.getByTestId('update-ready')
    await expect(toast.getByTestId('update-version')).toHaveText(next)
    await expect(toast.getByTestId('update-note')).toContainText(NEXT_LINE)
    await expect(toast.getByTestId('kind-label')).toHaveAttribute('data-kind', 'new')
    // Not forced: the old version is still the one in control until Reload is pressed.
    expect(await cacheNames(page)).toHaveLength(2)
    // Reload hands over to the new worker, and the page reloads itself once it takes control. The old page's canvas
    // is still visible until then, so wait for the reload itself before reading the caches.
    const reloaded = page.waitForEvent('load')
    await toast.getByTestId('toast-action').click()
    await reloaded
    await expect(page.getByTestId('app-canvas')).toBeVisible()
    await expect(page.locator('meta[name="next-version"]')).toHaveCount(1)
    await expect.poll(() => cacheNames(page)).toEqual([expect.stringContaining('bd-beads-next-')])
  })

  test('names what waits with no network, from the waiting copy itself (ticket 1048)', async ({ page, context }) => {
    await openAndInstall(page)
    const next = nextOf(await pageVersion(page))
    host.rewrite = newVersion
    await lookForUpdate(page)
    await expect(page.getByTestId('update-ready')).toBeVisible()

    await context.setOffline(true)
    await reloadsIntoTheApp(page)
    await expect(page.getByTestId('update-version')).toHaveText(next)
    await expect(page.getByTestId('update-note')).toContainText(NEXT_LINE)
  })

  test("What's new opens the Homepage at What's new, unfolded (ticket 1048)", async ({ page }) => {
    await openAndInstall(page)
    host.rewrite = newVersion
    await lookForUpdate(page)
    await page.getByTestId('update-ready').getByTestId('toast-second-action').click()

    await expect(page.getByTestId('homepage')).toBeVisible()
    await expect(page.getByTestId('homepage-whats-new-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('homepage-whats-new-block').first()).toBeInViewport()
  })

  test("What's new shows what waits in a box on top, and its Reload switches over, the notes then in their blocks (ticket 1049)", async ({ page }) => {
    await openAndInstall(page)
    const next = nextOf(await pageVersion(page))
    host.rewrite = newVersion
    await lookForUpdate(page)
    await page.getByTestId('update-ready').getByTestId('toast-second-action').click()

    const waiting = page.getByTestId('homepage-whats-new-waiting')
    await expect(waiting).toBeInViewport()
    await expect(waiting.locator('.whats-new__version')).toHaveText(next)
    await expect(waiting.getByTestId('homepage-release-note')).toHaveCount(1)
    await expect(waiting.getByTestId('homepage-release-note')).toContainText(NEXT_LINE)
    const reloaded = page.waitForEvent('load')
    await waiting.getByTestId('homepage-whats-new-reload').click()
    await reloaded
    await expect(page.locator('meta[name="next-version"]')).toHaveCount(1)
    await expect(page.getByTestId('homepage-whats-new-block').first()).toContainText(NEXT_LINE)
    await expect(page.getByTestId('homepage-whats-new-waiting')).toHaveCount(0)
  })

  test('a refresh keeps the version the page was on, and offers Update ready again (ticket 1041)', async ({ page }) => {
    await openAndInstall(page)
    host.rewrite = newVersion
    await lookForUpdate(page)
    await expect(page.getByTestId('update-ready')).toBeVisible()
    const scripts = () => page.evaluate(() => [...document.scripts].map((script) => script.src))
    const before = await scripts()

    await reloadsIntoTheApp(page)
    // The host has the newer page; the one shown is the one the device holds, with its own scripts.
    await expect(page.locator('meta[name="next-version"]')).toHaveCount(0)
    expect(await scripts()).toEqual(before)
    await expect(page.getByTestId('update-ready')).toBeVisible()
    expect(await cacheNames(page)).toHaveLength(2)
  })

  test('a Build with the page\'s own Version raises no toast, and arrives when the app is opened again (ticket 1048)', async ({ page, context }) => {
    await openAndInstall(page)
    host.rewrite = sameVersion
    await lookForUpdate(page)
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.waiting !== null)).toBe(true)
    // The question to the waiting worker has had its time to be answered.
    await page.waitForTimeout(2500)
    await expect(page.getByTestId('update-ready')).toHaveCount(0)

    await page.close()
    const again = await context.newPage()
    await again.goto(host.url)
    await expect(again.getByTestId('app-canvas')).toBeVisible()
    await expect(again.locator('meta[name="next-version"]')).toHaveCount(1)
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
    await page.addInitScript(() => sessionStorage.setItem('openbeads:editor-chosen', '1'))
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

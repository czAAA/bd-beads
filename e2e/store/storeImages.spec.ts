import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { openApp, openStripPanel, settle } from '../support/app'
import { fixtureProject } from '../support/projects'
import { LOCALES } from '../../src/domain/locale'
import { PREVIEW_SIZE, previewFile } from '../../vite.crawler'

// The installed app's PNG icons and its store screenshots (ticket 1057), and the link previews' pictures (ticket 1056),
// remade by `npm run store:images`, never in CI. The icons are the design system's own app icon, drawn by the browser
// at each size; the screenshots are the editor with a Starter's Project open; the previews are each language's Welcome
// on a new device. The files land in public/, where the manifest and the Homepages' heads name them.

const repo = resolve(import.meta.dirname, '../..')
const APP_ICON = resolve(repo, 'docs/design/system/assets/Logos/bd-beads-app-icon.svg')
const out = (path: string) => resolve(repo, 'public', path)

/** The app icon's own colour, its rounded square's fill: the maskable icon's full-bleed background. */
function iconColor(svg: string): string {
  const fill = /<rect\b[^>]*\bfill="(#[0-9a-f]{6})"/i.exec(svg)?.[1]
  if (!fill) throw new Error('no fill on the app icon\'s square')
  return fill
}

/** Draws `svg` alone at `size` px square and saves it as a PNG. `inset` is the share of the square the icon takes,
 * centred on `background`; with none, the icon fills it and its rounded corners stay clear. */
async function drawIcon(page: Page, svg: string, size: number, path: string, fit?: { inset: number; background: string }) {
  await page.setViewportSize({ width: size, height: size })
  const side = fit ? size * fit.inset : size
  const SIZE_ATTRIBUTES = /\swidth="\d+"\s+height="\d+"/
  if (!SIZE_ATTRIBUTES.test(svg)) throw new Error('no width and height on the app icon')
  const sized = svg.replace(SIZE_ATTRIBUTES, ` width="${side}" height="${side}"`)
  await page.setContent(
    `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${fit?.background ?? 'transparent'}">${sized}</body></html>`,
  )
  await page.screenshot({ path: out(path), omitBackground: !fit, clip: { x: 0, y: 0, width: size, height: size } })
}

test('the app icon as PNG, at 192 and 512 px and maskable', async ({ page }) => {
  const svg = readFileSync(APP_ICON, 'utf8')
  await drawIcon(page, svg, 192, 'icons/bd-beads-app-icon-192.png')
  await drawIcon(page, svg, 512, 'icons/bd-beads-app-icon-512.png')
  // A mask may keep only the circle 80% across (the W3C safe zone): the icon at 80% keeps its mark inside it, and its
  // square's colour fills the rest, so a round or squircle mask cuts only background.
  await drawIcon(page, svg, 512, 'icons/bd-beads-app-icon-maskable-512.png', { inset: 0.8, background: iconColor(svg) })
})

/** The two sizes a store shows, a desktop window (the Microsoft Store's smallest, 1366 × 768) and an iPad held tall,
 * each with the best Starter of a category whose shape fills it: a Band lies across, a Fringe earring hangs down. */
const SCREENSHOTS = [
  { path: 'screenshots/editor-wide.png', viewport: { width: 1366, height: 768 }, category: 'bands', starter: 'bandDiamonds' },
  { path: 'screenshots/editor-tall.png', viewport: { width: 820, height: 1180 }, category: 'earrings', starter: 'vFringe' },
] as const

for (const { path, viewport, category, starter } of SCREENSHOTS) {
  test(`the editor with a Project open, ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    // The Project a maker gets from New Project's Starter, as the app makes it.
    await openStripPanel(page, 'strip-menu')
    await page.getByTestId('menu-new-project').click()
    await page.getByTestId('pick-starter').click()
    await page.getByTestId(`starter-category-${category}`).click()
    await page.getByTestId(`starter-card-${starter}`).click()
    await page.getByTestId('create-starter-project').click()
    await expect(page.getByTestId('panel-dropdown')).toHaveCount(0)
    await page.mouse.move(5, 5)
    await settle(page)
    await page.screenshot({ path: out(path) })
  })
}

for (const locale of LOCALES) {
  test(`the Welcome in ${locale} for a link preview, ${PREVIEW_SIZE.width} × ${PREVIEW_SIZE.height}`, async ({ page }) => {
    await page.setViewportSize(PREVIEW_SIZE)
    // A new device at the language's Homepage: what a person who follows the shared link sees first.
    await openApp(page, [], locale === 'en' ? './' : `./${locale}/`, { canvasHidden: true })
    await expect(page.getByTestId('homepage-welcome')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(5, 5)
    await settle(page)
    await page.screenshot({ path: out(previewFile(locale)) })
  })
}

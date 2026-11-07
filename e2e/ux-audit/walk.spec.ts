import { test } from '@playwright/test'
import { AREA_WALKS, AREAS, isArea } from './areas'
import { openForAudit, Walk } from './support'

/** Time for the offline shell's service worker to install and fill its cache after the first load. */
const OFFLINE_SHELL_INSTALL_MS = 4000
/** Time for a panel to open or a page to settle after a reload. */
const PANEL_MS = 1500

/** The UX audit's screenshot walk (ticket 0815): `UX_AREA` names the area; `scripts/ux-walk.sh` sets it and picks the
 * devices. Each test is one device (the Playwright project) in one state; a step that can't be done is recorded in
 * `stops.json`, never a failure, so one broken control doesn't hide the rest of the path. */

const area = process.env.UX_AREA
if (!isArea(area)) {
  throw new Error(`UX_AREA must be one of ${AREAS.join(', ')}; run npm run ux:walk -- <area>`)
}
const { states, run } = AREA_WALKS[area]

for (const state of states) {
  test(`${area} · ${state}`, async ({ page }, testInfo) => {
    const walk = new Walk(page, testInfo, area, state)
    await run(walk)
  })
}

// Keep it, offline: the offline shell needs its service worker, which the other walks block.
if (area === 'keep-it') {
  test.describe(() => {
    test.use({ serviceWorkers: 'allow' })
    test('keep-it · seeded-offline', async ({ page, context }, testInfo) => {
      const walk = new Walk(page, testInfo, area, 'seeded-offline')
      await walk.step('offline-shell-installed', async () => {
        await openForAudit(walk)
        await page.waitForTimeout(OFFLINE_SHELL_INSTALL_MS)
      })
      await walk.step('offline-reloaded', async () => {
        await context.setOffline(true)
        await page.reload()
        await page.getByTestId('app-canvas').waitFor()
        await page.waitForTimeout(PANEL_MS)
      })
      await walk.step('offline-project-panel', async () => {
        await page.getByTestId('strip-project').click()
        await page.waitForTimeout(PANEL_MS)
      })
      await context.setOffline(false)
    })
  })
}

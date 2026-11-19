import { expect, test, type Page } from '@playwright/test'
import { openApp } from '../support/app'
import { fixtureProject } from '../support/projects'

// The Homepage's last section fills its room on a large screen (ticket 1060), at 1920 × 1080: a new visitor's Free to use
// on a plain ground, centred in the room, in light, dark and high contrast; with Projects saved, No account's list
// starting with the rows that fit.
const SCHEMES = { light: { colorScheme: 'light' }, dark: { colorScheme: 'dark' }, contrast: { colorScheme: 'light', contrast: 'more' } } as const

async function lastSection(page: Page, withProjects: boolean, scheme: keyof typeof SCHEMES): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.emulateMedia(SCHEMES[scheme])
  // Out of the Winter charms' season (ticket 1102), which has a look of its own.
  await page.clock.setFixedTime(new Date('2026-11-18T12:00:00'))
  await openApp(page, withProjects ? [fixtureProject({ technique: 'loom' })] : [], './', { canvasHidden: true })
  await page.locator('[data-testid="section-step"][data-step="plans"]').click()
  await expect(page.getByTestId(withProjects ? 'plan-no-account' : 'free-to-use')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

for (const scheme of Object.keys(SCHEMES) as (keyof typeof SCHEMES)[]) {
  test(`Free to use at 1920 × 1080 in ${scheme} (ticket 1060)`, async ({ page }) => {
    await lastSection(page, false, scheme)
    await expect(page).toHaveScreenshot(`homepage-free-to-use-${scheme}.png`, { maxDiffPixelRatio: 0.01 })
  })
}

test('Three ways to use it at 1920 × 1080 (ticket 1060)', async ({ page }) => {
  await lastSection(page, true, 'light')
  await expect(page).toHaveScreenshot('homepage-three-ways.png', { maxDiffPixelRatio: 0.01 })
})

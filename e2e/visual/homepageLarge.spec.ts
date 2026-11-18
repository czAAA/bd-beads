import { expect, test } from '@playwright/test'

// On a large screen the Homepage's box and its sections grow by a third (ticket 1059), the strip and the Progress bar
// at the editor's size, the two marks by the box's edge: Welcome at 2560 × 1440 in light, dark and high contrast.
for (const scheme of ['light', 'dark', 'contrast'] as const) {
  test(`Welcome at 2560 × 1440 in ${scheme} (ticket 1059)`, async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 })
    await page.emulateMedia(scheme === 'contrast' ? { colorScheme: 'light', contrast: 'more' } : { colorScheme: scheme })
    await page.goto('./')
    await expect(page.getByTestId('homepage-welcome')).toBeVisible()
    await expect(page.getByTestId('welcome-piece')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot(`homepage-large-${scheme}.png`, { maxDiffPixelRatio: 0.01 })
  })
}

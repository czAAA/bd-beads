import { expect, test, type Page } from '@playwright/test'
import { openApp, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// Ticket 1024: the preview sends the pages with the policy the deployed app has (vite.headers.ts), so every check here
// runs under it. These say so outright: the policy is in force, and the two pages' own scripts get through it.

/** Everything the page's policy refuses from now on, across page loads, as `directive: what was refused`. */
async function watchPolicy(page: Page): Promise<string[]> {
  const refused: string[] = []
  await page.exposeFunction('policyRefused', (line: string) => refused.push(line))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      void (window as unknown as { policyRefused: (line: string) => void }).policyRefused(`${event.violatedDirective}: ${event.blockedURI}`)
    })
  })
  return refused
}

test('the editor opens with nothing refused, and a script put into the page does not run', async ({ page }) => {
  const refused = await watchPolicy(page)
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await settle(page)
  expect(refused).toEqual([])

  const ran = await page.evaluate(() => {
    const script = document.createElement('script')
    script.textContent = 'window.gotIn = true'
    document.head.append(script)
    return 'gotIn' in window
  })
  expect(ran).toBe(false)
  await expect.poll(() => refused).toEqual(['script-src-elem: inline'])
})

test.describe('with motion', () => {
  // The handoff's scripts stand aside under reduced motion; here they run, and put the remembered strip into the page.
  test.use({ reducedMotion: 'no-preference' })

  test('the Homepage hands its box to the editor with nothing refused', async ({ page }) => {
    const refused = await watchPolicy(page)
    await openApp(page, [fixtureProject({ technique: 'loom' })], './homepage/', { canvasHidden: true })
    await page.getByTestId('welcome-open-editor').click()
    await page.waitForURL((url) => !url.pathname.includes('homepage'))
    await expect(page.locator('#app .canvas-strip')).toBeVisible()
    await settle(page)
    expect(refused).toEqual([])
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import type {} from '@vitest/browser-playwright'
import { cdp, page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import { fakeFeedback } from '../../testUtils/fakeFeedback'
import { turnToSection } from '../../testUtils/homepageSection'
import type { InsideChapterId } from '../../i18n/translations'
import HomePage from '../HomePage.vue'

// A chapter pressed leaves no question over the demo (ticket 0924): the rows before it are applied at once, and every
// confirmation they raise is answered, so when the chapter's first row plays the demo shows what its caption says.

/** The tour plays with motion: these tests otherwise run under reduced motion, which shows each row's end at once. */
async function withMotion(on: boolean): Promise<void> {
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'no-preference' : 'reduce' }] })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await withMotion(false)
})

const CHAPTERS: InsideChapterId[] = ['draw', 'startFrom', 'beadColors', 'weaveKeep']

describe("What's inside: a chapter pressed leaves no question open (ticket 0924)", () => {
  for (const chapter of CHAPTERS) {
    it(`${chapter}: no dialog is open when its first row plays, and no row before it failed`, async () => {
      await withMotion(true)
      const mounted = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width: 1440 })
      await page.viewport(1440, 900)
      const editor = mounted.root.querySelector('[data-testid="inside-editor"]')!
      await turnToSection(mounted.root, 'inside')
      const lit = () => mounted.root.querySelector('[data-testid="inside-chapters"] [aria-current="step"]')?.getAttribute('data-testid')
      await expect.poll(lit, { timeout: 8000 }).toBe('inside-chapter-draw')
      const warn = vi.spyOn(console, 'warn')
      mounted.root.querySelector<HTMLElement>(`[data-testid="inside-chapter-${chapter}"]`)!.click()
      // The ghost first shows once the rows before it are applied: the chapter's first row has started.
      await expect.poll(() => !!editor.querySelector('[data-testid="inside-ghost"] .ghost--shown'), { timeout: 30_000, interval: 20 }).toBe(true)
      expect(lit()).toBe(`inside-chapter-${chapter}`)
      expect([...editor.querySelectorAll('[role="alertdialog"]')].map((dialog) => dialog.getAttribute('data-testid'))).toEqual([])
      expect(warn, 'a row applied at once that could not be done').not.toHaveBeenCalled()
    }, 60_000)
  }
})

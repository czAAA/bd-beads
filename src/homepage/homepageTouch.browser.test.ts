import { describe, expect, it } from 'vitest'
import { mountAt } from '../testUtils/browserFit'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import { emulateTouch, hitAreaProblems } from '../testUtils/hitAreas'
import { turnToSection } from '../testUtils/homepageSection'
import { tokenPx } from '../testUtils/tokenPx'
import HomePage from './HomePage.vue'

// On touch the Homepage's section steps and What's inside's chapters take a finger (ticket 0962): a step answers across
// `touch-target`; the chapters touch, so each is a `panel-row-touch` row, its hit area (responsive.md's panel-row
// exception), none under another pad. At an iPad's width (the list beside the demo) and a smaller tablet's (the band).
describe('the Homepage on touch (ticket 0962)', () => {
  for (const width of [1366, 820]) {
    it(`gives each section step a touch-target hit area and each chapter its row, ${width}px wide`, async () => {
      await emulateTouch()
      const { root } = await mountAt(HomePage, { projectCount: 0, feedback: fakeFeedback() }, { locale: 'en', width })
      const steps = [...root.querySelectorAll<HTMLElement>('[data-testid="section-step"]')]
      expect(steps).toHaveLength(4)
      // More below rides on the bar's top edge; its pad lies over no step.
      const controls = { ...Object.fromEntries(steps.map((step) => [`step ${step.dataset.step}`, step])), 'more below': root.querySelector('[data-testid="more-below-button"]')! }
      expect(hitAreaProblems(controls, tokenPx(root, '--touch-target'))).toEqual([])

      await turnToSection(root, 'inside')
      const chapters = [...root.querySelectorAll<HTMLElement>('[data-testid^="inside-chapter-"]')]
      expect(chapters).toHaveLength(4)
      const row = tokenPx(root, '--panel-row-touch')
      // Open editor from here (and Pause, which reduced motion, as the tests run, leaves out), beside or under the
      // chapters, answers across `touch-target`, its pad clear of them. The list's rows are its width wide; the band's
      // chapters their names', wider than a row is tall.
      const buttons = Object.fromEntries([...root.querySelectorAll('.inside__control')].map((button, index) => [`button ${index}`, button]))
      expect(Object.keys(buttons).length).toBeGreaterThan(0)
      expect(hitAreaProblems(buttons, tokenPx(root, '--touch-target'))).toEqual([])
      expect(hitAreaProblems({ ...Object.fromEntries(chapters.map((chapter) => [chapter.dataset.testid!, chapter])), ...buttons }, row)).toEqual([])
    })
  }
})

import { describe, expect, it } from 'vitest'
import { createProject } from '../../domain/createProject'
import { LOCALES } from '../../domain/locale'
import { mountAt } from '../../testUtils/browserFit'
import ProjectHead from './ProjectHead.vue'

// The Project's name and the Maker's name each follow their own colon by one space, and sit on the centre line of the
// label, whatever the words of the labels in each language (tickets 554, 568). Every real language, as a script's own
// glyphs move the centre line, which the "longest" text would not show (ticket 0606).
const project = { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), makerName: 'Maria' }

describe('ProjectHead alignment', () => {
  for (const locale of LOCALES) {
    it(`puts each value one space after its label, on its centre line, in ${locale}`, async () => {
      const { root } = await mountAt(ProjectHead, { project, saveFailed: false, unsaved: false }, { locale, width: 390 })
      for (const testid of ['project-name', 'project-maker']) {
        const row = root.querySelector(`[data-testid="${testid}-row"]`)!
        const label = row.querySelector('.editable-line__label')!.getBoundingClientRect()
        const value = root.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect()
        expect(value.left - label.right).toBeGreaterThan(0)
        expect(value.left - label.right).toBeLessThan(12)
        expect(Math.abs(value.top + value.height / 2 - (label.top + label.height / 2))).toBeLessThan(1.5)
      }
    })
  }
})

// The save state is written out beside its icon, not only said on hover (ticket 0858), on a phone too.
describe('ProjectHead save state', () => {
  it('shows the state in words on the title line, before its check', async () => {
    const { root } = await mountAt(ProjectHead, { project, saveFailed: false, unsaved: false }, { locale: 'en', width: 390 })
    const words = root.querySelector('[data-testid="save-state"]')!.getBoundingClientRect()
    const icon = root.querySelector('[data-testid="save-icon"]')!.getBoundingClientRect()
    expect(words.width).toBeGreaterThan(icon.width)
    expect(words.right).toBeLessThanOrEqual(icon.left)
    expect(Math.abs(words.top + words.height / 2 - (icon.top + icon.height / 2))).toBeLessThan(2)
  })
})

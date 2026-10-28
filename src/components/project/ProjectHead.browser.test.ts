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

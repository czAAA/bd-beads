import { describe, expect, it } from 'vitest'
import { createProject } from '../../domain/project'
import { FIT_LOCALES, mountAt } from '../../testUtils/browserFit'
import ProjectHead from './ProjectHead.vue'

// The Project's name and the Maker's name are two lines of one column: their values start at the same place, whatever
// the words of the labels in each language (ticket 554).
const project = { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), makerName: 'Maria' }

describe('ProjectHead alignment', () => {
  for (const locale of FIT_LOCALES) {
    it(`starts the name and the maker values at one edge in ${locale}`, async () => {
      const { root } = await mountAt(ProjectHead, { project, saveFailed: false, unsaved: false }, { locale, width: 390 })
      const left = (testid: string) => root.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect().left
      expect(left('project-maker')).toBe(left('project-name'))
    })
  }
})

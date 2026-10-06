import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, beadLabel } from '../../domain/beads'
import { turnedClockwise } from '../../testUtils/rotated'
import { createProject, moveToRow, setRowProgressEnabled, type Project, frameGrid, withFrameGrid } from '../../domain/project'
import { en } from '../../i18n/en'
import { useProjectLabels } from './useProjectLabels'

const bead = BEAD_CATALOG.find((candidate) => candidate.id === 'toho-cube-1.5mm')!
const base = createProject({ technique: 'loom', beadId: bead.id, name: 'Logo panel', size: { width: 4, height: 3, unit: 'beads' } })

function setup(project: Project | undefined = base) {
  return useProjectLabels({ currentProject: () => project, messages: () => en, locale: () => 'en' })
}

function withColors(project: Project, colors: string[]): Project {
  const cells = colors.map((color) => ({ color }))
  return withFrameGrid(project, frameGrid(project).map((row, r) => row.map((cell, c) => (r === 0 && cells[c] ? { ...cell, ...cells[c] } : cell))))
}

describe('useProjectLabels', () => {
  describe('activeBeadLabel', () => {
    it('is the Bead’s own label', () => {
      expect(setup().activeBeadLabel.value).toBe(beadLabel(bead))
    })

    it('is a neutral placeholder for a Bead the catalog does not have', () => {
      const unknown = { ...base, beadId: 'custom-that-was-removed' }
      expect(setup(unknown).activeBeadLabel.value).toBe(en.projects.unknownBeadLabel)
    })

    it('is undefined with no Project open', () => {
      expect(useProjectLabels({ currentProject: () => undefined, messages: () => en, locale: () => 'en' }).activeBeadLabel.value).toBeUndefined()
    })
  })

  describe('projectLabel', () => {
    it('names the Project, its size and its colors', () => {
      const painted = withColors(base, ['#ff0000', '#00ff00', '#ff0000'])
      expect(setup(painted).projectLabel.value).toBe('Logo panel, 4 by 3 beads, 2 colors')
    })

    it('says one color in the singular', () => {
      expect(setup(withColors(base, ['#ff0000'])).projectLabel.value).toBe('Logo panel, 4 by 3 beads, 1 color')
    })

    it('swaps the axes once the Project is turned a quarter', () => {
      expect(setup(turnedClockwise(base)).projectLabel.value).toBe('Logo panel, 3 by 4 beads, 0 colors')
    })

    it('adds the Row progress once it is on', () => {
      const tracking = moveToRow(setRowProgressEnabled(base, true), 2)
      expect(setup(tracking).projectLabel.value).toMatch(/, row 2 of 3 done$/)
    })

    it('names a canvas with no Frame as an open canvas, with no size to state', () => {
      const { frame: _frame, ...open } = withColors(base, ['#ff0000'])
      expect(setup(open as Project).projectLabel.value).toBe('Logo panel, open canvas with no Frame, 1 color')
    })

    it('is undefined with no Project open', () => {
      expect(useProjectLabels({ currentProject: () => undefined, messages: () => en, locale: () => 'en' }).projectLabel.value).toBeUndefined()
    })
  })
})

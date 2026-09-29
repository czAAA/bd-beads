import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, beadLabel } from '../domain/beads'
import { createPattern, moveToRow, setRowProgressEnabled, toggleRotated, type Pattern } from '../domain/pattern'
import { en } from '../i18n/en'
import { usePatternLabels } from './usePatternLabels'

const bead = BEAD_CATALOG.find((candidate) => candidate.id === 'toho-cube-1.5mm')!
const base = createPattern({ technique: 'loom', beadId: bead.id, name: 'Logo panel', size: { width: 4, height: 3, unit: 'beads' } })

function setup(pattern: Pattern | undefined = base) {
  return usePatternLabels({ currentPattern: () => pattern, messages: () => en, locale: () => 'en' })
}

function withColors(pattern: Pattern, colors: string[]): Pattern {
  const cells = colors.map((color) => ({ color }))
  return { ...pattern, grid: pattern.grid.map((row, r) => row.map((cell, c) => (r === 0 && cells[c] ? { ...cell, ...cells[c] } : cell))) }
}

describe('usePatternLabels', () => {
  describe('activeBeadLabel', () => {
    it('is the Bead’s own label', () => {
      expect(setup().activeBeadLabel.value).toBe(beadLabel(bead))
    })

    it('is a neutral placeholder for a Bead the catalog does not have', () => {
      const unknown = { ...base, beadId: 'custom-that-was-removed' }
      expect(setup(unknown).activeBeadLabel.value).toBe(en.patterns.unknownBeadLabel)
    })

    it('is undefined with no Pattern open', () => {
      expect(usePatternLabels({ currentPattern: () => undefined, messages: () => en, locale: () => 'en' }).activeBeadLabel.value).toBeUndefined()
    })
  })

  describe('patternLabel', () => {
    it('names the Pattern, its size and its colors', () => {
      const painted = withColors(base, ['#ff0000', '#00ff00', '#ff0000'])
      expect(setup(painted).patternLabel.value).toBe('Logo panel, 4 by 3 beads, 2 colors')
    })

    it('says one color in the singular', () => {
      expect(setup(withColors(base, ['#ff0000'])).patternLabel.value).toBe('Logo panel, 4 by 3 beads, 1 color')
    })

    it('swaps the axes once the Pattern is turned a quarter', () => {
      expect(setup(toggleRotated(base)).patternLabel.value).toBe('Logo panel, 3 by 4 beads, 0 colors')
    })

    it('adds the Row progress once it is on', () => {
      const tracking = moveToRow(setRowProgressEnabled(base, true), 2)
      expect(setup(tracking).patternLabel.value).toMatch(/, row 2 of 3 done$/)
    })

    it('is undefined with no Pattern open', () => {
      expect(usePatternLabels({ currentPattern: () => undefined, messages: () => en, locale: () => 'en' }).patternLabel.value).toBeUndefined()
    })
  })
})

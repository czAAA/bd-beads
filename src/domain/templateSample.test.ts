import { describe, expect, it } from 'vitest'
import { TEMPLATES } from './templates'
import { generateOrnament, sampleColors, sampleSize, seedOf, type SampleTheme } from './templateSample'
import { TECHNIQUES } from './weave'

const THEMES: SampleTheme[] = ['light', 'dark', 'contrast']

describe('the sample ornament', () => {
  it('is the same for the same Weave, size and seed', () => {
    const colors = sampleColors('light')
    const once = generateOrnament({ technique: 'loom' }, { columns: 9, rows: 11 }, 7, colors)
    expect(generateOrnament({ technique: 'loom' }, { columns: 9, rows: 11 }, 7, colors)).toEqual(once)
  })

  it.each([0, 1, 2, 3, 4, 5, seedOf('gerdan'), seedOf('earrings')])('is symmetric left to right and top to bottom (seed %i)', (seed) => {
    const grid = generateOrnament({ technique: 'loom' }, { columns: 10, rows: 7 }, seed, sampleColors('light'))
    expect(grid.map((row) => [...row].reverse())).toEqual(grid)
    expect([...grid].reverse()).toEqual(grid)
  })

  it('has the positions of the Weave and only the colors it is given', () => {
    for (const technique of TECHNIQUES) {
      const colors = sampleColors('dark')
      const grid = generateOrnament({ technique }, { columns: 6, rows: 5 }, 3, colors)
      expect(grid.length).toBeGreaterThan(0)
      expect(grid.flat().every((hex) => colors.includes(hex))).toBe(true)
    }
  })

  it('uses more than one color in every theme', () => {
    for (const theme of THEMES) {
      for (const template of TEMPLATES) {
        const size = sampleSize(template.width.default, template.height.default)
        const grid = generateOrnament({ technique: template.technique }, size, seedOf(template.id), sampleColors(theme))
        expect(new Set(grid.flat()).size).toBeGreaterThan(1)
      }
    }
  })

  it('keeps the Template shape in a few beads', () => {
    expect(sampleSize(24, 80)).toEqual({ columns: 5, rows: 11 })
    expect(sampleSize(20, 40)).toEqual({ columns: 6, rows: 11 })
    expect(sampleSize(10, 10)).toEqual({ columns: 11, rows: 11 })
  })
})

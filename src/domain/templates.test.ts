import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { createProject } from './project'
import { describeWeave } from './weave'
import { clampAxis, TEMPLATES, templateById, templateProjectInput } from './templates'

const beadId = BEAD_CATALOG[0]!.id

describe('the Template registry', () => {
  it('has the five Templates, Gerdan first', () => {
    expect(TEMPLATES.map((template) => template.id)).toEqual(['gerdan', 'bracelet', 'earrings', 'bag', 'custom'])
  })

  for (const template of TEMPLATES) {
    describe(template.id, () => {
      it('allows its default Technique', () => {
        expect(template.techniques).toContain(template.technique)
      })

      it.each(['width', 'height'] as const)('keeps %s, its default and presets inside its limits', (side) => {
        const axis = template[side]
        expect(axis.min).toBeLessThanOrEqual(axis.default)
        expect(axis.default).toBeLessThanOrEqual(axis.max)
        for (const preset of axis.presets ?? []) {
          expect(preset).toBeGreaterThanOrEqual(axis.min)
          expect(preset).toBeLessThanOrEqual(axis.max)
        }
      })

      it.each(template.techniques)('makes a valid Project with an empty Frame in %s', (technique) => {
        const project = createProject(
          templateProjectInput(template, { technique, beadId, name: '', columns: template.width.default, rows: template.height.default }),
        )

        expect(project.technique).toBe(technique)
        // Right-angle weave and Netting count Units, which take more positions (ticket 482).
        const positions = describeWeave(project.frame!).positionsOf({ columns: template.width.default, rows: template.height.default })
        expect(project.frame).toMatchObject({ row: 0, column: 0, ...positions, technique, beads: {} })
        expect(project.beads).toEqual({})
      })
    })
  }

  it('holds a locked side at its default, whatever is asked', () => {
    const earrings = templateById('earrings')
    expect(clampAxis(earrings.width, 30)).toBe(10)
    expect(templateProjectInput(earrings, { beadId, name: '', columns: 30, rows: 48 }).size).toMatchObject({ width: 10, height: 48 })
  })

  it('holds a free side inside its limits', () => {
    const bracelet = templateById('bracelet')
    expect(clampAxis(bracelet.height, 5000)).toBe(bracelet.height.max)
    expect(clampAxis(bracelet.height, 0)).toBe(bracelet.height.default)
    expect(clampAxis(bracelet.height, -4)).toBe(bracelet.height.min)
  })

  it('falls back to the default Technique for one the Template does not allow', () => {
    const input = templateProjectInput(templateById('earrings'), { technique: 'netting', beadId, name: '', columns: 10, rows: 48 })
    expect(input.technique).toBe('peyote')
  })

  it('carries the Brick block for brick stitch only', () => {
    const bag = templateById('bag')
    expect(templateProjectInput(bag, { technique: 'brick', brickBlock: 3, beadId, name: '', columns: 20, rows: 40 }).brickBlock).toBe(3)
    expect(templateProjectInput(bag, { technique: 'loom', brickBlock: 3, beadId, name: '', columns: 20, rows: 40 }).brickBlock).toBeUndefined()
  })
})

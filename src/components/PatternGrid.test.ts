import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternGrid from './PatternGrid.vue'
import { createPattern } from '../domain/pattern'
import { BEAD_CATALOG } from '../domain/beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

describe('PatternGrid', () => {
  it('renders one row per pattern row and one cell per pattern column', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })

    const rows = wrapper.findAll('[data-testid="grid-row"]')
    expect(rows).toHaveLength(pattern.rows)
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')).toHaveLength(pattern.columns)
  })

  it('does not offset loom rows', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const rows = wrapper.findAll('[data-testid="grid-row"]')

    expect(rows[0]!.attributes('style')).toContain('margin-left: 0px')
    expect(rows[1]!.attributes('style')).toContain('margin-left: 0px')
  })

  it('offsets alternating Peyote rows by half a cell', () => {
    const pattern = createPattern({
      technique: 'peyote',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const rows = wrapper.findAll('[data-testid="grid-row"]')

    expect(rows[0]!.attributes('style')).toContain('margin-left: 0px')
    expect(rows[1]!.attributes('style')).toContain('margin-left: 10px')
  })

  it('renders Brick stitch with the same horizontal row offset as Peyote but stacked at full row height', () => {
    const pattern = createPattern({
      technique: 'brick',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const wrapper = mount(PatternGrid, { props: { pattern } })
    const rows = wrapper.findAll('[data-testid="grid-row"]')

    expect(rows[1]!.attributes('style')).toContain('margin-left: 10px')
    expect(rows[1]!.attributes('style')).toContain('margin-top: 0px')
    expect(wrapper.classes()).toContain('pattern-grid--brick')
    expect(wrapper.classes()).not.toContain('pattern-grid--peyote')
  })

  it("packs Peyote's rows tighter than a full cell, unlike Brick stitch's full-height rows", () => {
    const peyote = createPattern({
      technique: 'peyote',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })
    const brick = createPattern({
      technique: 'brick',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const peyoteWrapper = mount(PatternGrid, { props: { pattern: peyote } })
    const brickWrapper = mount(PatternGrid, { props: { pattern: brick } })

    expect(peyoteWrapper.findAll('[data-testid="grid-row"]')[1]!.attributes('style')).toContain(
      'margin-top: -5px',
    )
    expect(brickWrapper.findAll('[data-testid="grid-row"]')[1]!.attributes('style')).toContain(
      'margin-top: 0px',
    )
  })
})

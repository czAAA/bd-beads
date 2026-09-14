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
})

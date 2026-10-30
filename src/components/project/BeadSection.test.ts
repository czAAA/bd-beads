import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadSection from './BeadSection.vue'
import { BEAD_CATALOG, offeredBeads } from '../../domain/beads'
import { choosePanelOption, panelOptionShown } from '../../testUtils/choosePanelOption'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const bead = BEAD_CATALOG[0]!
const mountSection = (props: Record<string, unknown> = {}) =>
  mount(BeadSection, { props: { bead, candidates: offeredBeads(), ...props } })

describe('BeadSection (ticket 568)', () => {
  it('shows the Bead it is given as Brand, Type and Size', () => {
    const wrapper = mountSection()

    expect(panelOptionShown(wrapper, 'bead-brand')).toBe(bead.brand.name)
    expect(panelOptionShown(wrapper, 'bead-size')).toBe(bead.size)
  })

  it('only asks for another Bead and keeps showing its own until the parent changes it', async () => {
    const other = BEAD_CATALOG.find((candidate) => candidate.brand.id !== bead.brand.id)!
    const wrapper = mountSection()

    await choosePanelOption(wrapper, 'bead-brand', other.brand.id)

    expect(wrapper.emitted('pick')).toHaveLength(1)
    expect(panelOptionShown(wrapper, 'bead-brand')).toBe(bead.brand.name)
    await wrapper.setProps({ bead: other })
    expect(panelOptionShown(wrapper, 'bead-brand')).toBe(other.brand.name)
  })

  it('shows an out-of-date copy "(as saved)" beside the catalog’s Bead of its id, and asks for that one (ticket 534)', async () => {
    const current = offeredBeads()[0]!
    const copy = { ...current, widthMm: current.widthMm + 0.2 }
    const wrapper = mountSection({ bead: copy, candidates: offeredBeads(), outdated: true })

    expect(panelOptionShown(wrapper, 'bead-size')).toBe(`${copy.size} (as saved)`)
    await choosePanelOption(wrapper, 'bead-size', current.id)

    expect(wrapper.emitted('pick')).toEqual([[current.id]])
  })
})

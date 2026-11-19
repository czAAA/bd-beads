import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { findBead } from '../../domain/beads'
import { en } from '../../i18n/en'
import BeadColorsEntry from './BeadColorsEntry.vue'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

const delica = findBead('miyuki/delica/11-0')

const entry = (open: boolean) => mount(BeadColorsEntry, { props: { bead: delica, open, testid: 'entry' } })

describe('BeadColorsEntry (ticket 0746)', () => {
  it('reads "Palette" and the Bead’s own label, as the Bead is named everywhere', () => {
    expect(entry(false).get('[data-testid="entry"]').text()).toBe('Add Miyuki Delica 11/0 colors')
  })

  it('shows the Info button only while the list is open, holding the approximate and taken notes in its Tooltip', () => {
    expect(entry(false).find('[data-testid="bead-colors-info"]').exists()).toBe(false)

    const open = entry(true)
    const info = open.get('[data-testid="bead-colors-info"]')
    expect(info.attributes('aria-label')).toBe(en.palette.beadColors.info)
    expect(open.text()).toContain(en.palette.beadColors.approximate)
    expect(open.text()).toContain(en.palette.beadColors.takenNote)
  })

  it('says where the colors were read from instead, in the catalog\'s own words, for a catalog with measured colors (tickets 0886, 1068)', () => {
    const open = mount(BeadColorsEntry, { props: { bead: delica, open: true, testid: 'entry', measuredFrom: 'photographs' } })
    expect(open.text()).toContain(en.palette.beadColors.photoColors)
    expect(open.text()).not.toContain(en.palette.beadColors.approximate)
    expect(open.text()).toContain("MIYUKI's photographs")
  })

  it('points its chevron where the list is: down when it opens under the button, up when it opens above it (ticket 1092)', () => {
    const icon = (open: boolean, opensAbove: boolean) => mount(BeadColorsEntry, { props: { bead: delica, open, opensAbove, testid: 'entry' } }).get('[data-testid="entry"] svg').attributes('data-icon')
    expect([icon(false, false), icon(true, false)]).toEqual(['chevron-down', 'chevron-up'])
    expect([icon(false, true), icon(true, true)]).toEqual(['chevron-up', 'chevron-down'])
  })

  it('says a press takes a code out again only where a row can be pressed out (ticket 1092)', () => {
    const text = (removable: boolean) => mount(BeadColorsEntry, { props: { bead: delica, open: true, removable, testid: 'entry' } }).text()
    expect(text(true)).toContain(en.palette.beadColors.removeNote)
    expect(text(false)).not.toContain(en.palette.beadColors.removeNote)
  })

  it('reports its open state and emits toggle', async () => {
    const wrapper = entry(true)
    const button = wrapper.get('[data-testid="entry"]')

    expect(button.attributes('aria-expanded')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })
})

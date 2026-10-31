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
    expect(entry(false).get('[data-testid="entry"]').text()).toBe('Palette Miyuki Delica 11/0')
  })

  it('shows the Info button only while the list is open, holding the approximate and taken notes in its Tooltip', () => {
    expect(entry(false).find('[data-testid="bead-colors-info"]').exists()).toBe(false)

    const open = entry(true)
    const info = open.get('[data-testid="bead-colors-info"]')
    expect(info.attributes('aria-label')).toBe(en.palette.beadColors.info)
    expect(open.text()).toContain(en.palette.beadColors.approximate)
    expect(open.text()).toContain(en.palette.beadColors.takenNote)
  })

  it('reports its open state and emits toggle', async () => {
    const wrapper = entry(true)
    const button = wrapper.get('[data-testid="entry"]')

    expect(button.attributes('aria-expanded')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })
})

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import { FakeResizeObserver } from '../../testUtils/fakeResizeObserver'
import ConvertToBeadsPopover from './ConvertToBeadsPopover.vue'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

function mountPopover(props: Record<string, unknown> = {}) {
  return mount(ConvertToBeadsPopover, {
    props: {
      picture: { left: 100, top: 100, width: 200, height: 100 },
      barTop: 46,
      viewport: { width: 1000, height: 800 },
      size: { grid: '26×18', measure: '3.9 × 2.7 cm' },
      source: 'exact',
      colors: 14,
      colorsMax: 14,
      swatches: ['#ff0000', '#0000ff'],
      hideAfter: true,
      convertLabel: 'Convert 468 beads',
      ready: true,
      ...props,
    },
    attachTo: document.body,
  })
}

describe('ConvertToBeadsPopover (ReferenceImage card, ticket 0883)', () => {
  it('is a dialog with its size and color count, its first control focused', () => {
    const wrapper = mountPopover()
    const dialog = wrapper.get('[data-testid="convert-to-beads"]')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(document.activeElement).toBe(wrapper.get('[data-testid="convert-to-beads-close"]').element)
    expect(wrapper.get('[data-testid="convert-to-beads-size"]').text()).toBe('26×18 beads')
    expect(wrapper.get('[data-testid="convert-to-beads-count"]').text()).toBe('14 of 14')
    wrapper.unmount()
  })

  it('offers Exact first, the Bead\'s palette only with a Color catalog, and the Default Palette', () => {
    const without = mountPopover()
    expect(without.findAll('[data-testid="convert-to-beads-source"] [role="radio"]').map((option) => option.text())).toEqual([en.convertImage.wizard.exactShort, 'Default Palette'])
    without.unmount()
    const withCatalog = mountPopover({ beadName: 'TOHO Cube 1.5mm' })
    expect(withCatalog.findAll('[data-testid="convert-to-beads-source"] [role="radio"]').map((option) => option.text())).toEqual([en.convertImage.wizard.exactShort, 'TOHO Cube 1.5mm palette', 'Default Palette'])
    withCatalog.unmount()
  })

  it('notes where the Bead palette’s colors were read from when its catalog has them, in its own words (tickets 0886, 1068)', async () => {
    const note = async (props: Record<string, unknown>) => {
      const wrapper = mountPopover({ beadName: 'Miyuki Delica 11/0', source: 'bead-colors', ...props })
      const text = wrapper.get('.convert-popover__note').text()
      wrapper.unmount()
      return text
    }
    expect(await note({})).toContain('colors are approximate')
    expect(await note({ measuredFrom: 'photographs' })).toBe("The codes are real Miyuki Delica 11/0 beads. Their colors were read from MIYUKI's photographs: close to the real beads, not exact.")
  })

  it('says what it replaces, and asks for Convert, All settings and close', async () => {
    const wrapper = mountPopover({ replacedLabel: 'Replaces 3 beads already there.' })
    expect(wrapper.get('[data-testid="convert-to-beads-replaces"]').text()).toBe('Replaces 3 beads already there.')
    await wrapper.get('[data-testid="convert-to-beads-convert"]').trigger('click')
    await wrapper.get('[data-testid="convert-to-beads-all-settings"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('convert')).toHaveLength(1)
    expect(wrapper.emitted('all-settings')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})

import { describe, expect, it } from 'vitest'
import { addedColorId, defaultPaletteIds } from '../../domain/palette'
import { mountWithPalette } from '../../testUtils/paletteHost'
import ColorPopover from './ColorPopover.vue'

const added = addedColorId('#123456')

function open(ids: string[] = [...defaultPaletteIds(), added]) {
  const host = mountWithPalette(ColorPopover, ids, { tile: undefined, pill: undefined, position: 'bottom' }, { attachTo: document.body })
  const pencil = () => host.wrapper.find('[data-testid="color-popover-edit"]')
  const bin = () => host.wrapper.find('[data-testid="color-popover-remove-all"]')
  const escape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  return { ...host, pencil, bin, escape, popover: host.wrapper.findComponent(ColorPopover) }
}

describe('ColorPopover, Edit palette (tickets 531, 0532)', () => {
  it('offers the pencil only while the Palette has an added color', () => {
    const { wrapper, pencil } = open(defaultPaletteIds())
    expect(pencil().exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens in normal mode; the pencil enters the mode and shows the bin, which asks to remove every added color', async () => {
    const { wrapper, pencil, bin, requestRemoveAll } = open()
    expect(pencil().attributes('aria-pressed')).toBe('false')
    expect(bin().exists()).toBe(false)
    await pencil().trigger('click')
    expect(pencil().attributes('aria-pressed')).toBe('true')
    await bin().trigger('click')
    expect(requestRemoveAll).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('disables Pick color and Custom color in the mode, so the picker does not open', async () => {
    const { wrapper, pencil } = open()
    await pencil().trigger('click')
    for (const id of ['pick-color-button', 'custom-color-button']) expect(wrapper.get(`[data-testid="${id}"]`).attributes('aria-disabled')).toBe('true')
    await wrapper.get('[data-testid="custom-color-button"]').trigger('click')
    expect(wrapper.find('[data-testid="custom-color-panel"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('ends the mode on Escape without closing, and closes on the next', async () => {
    const { wrapper, pencil, escape, popover } = open()
    await pencil().trigger('click')
    escape()
    await wrapper.vm.$nextTick()
    expect(pencil().attributes('aria-pressed')).toBe('false')
    expect(popover.emitted('close')).toBeUndefined()
    escape()
    expect(popover.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('ends the mode with the last added color, and the pencil goes', async () => {
    const { wrapper, pencil, palette } = open()
    await pencil().trigger('click')
    const restore = palette.removeAdded(added)!
    await wrapper.vm.$nextTick()
    expect(pencil().exists()).toBe(false)
    restore()
    await wrapper.vm.$nextTick()
    expect(pencil().attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })
})

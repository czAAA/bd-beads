import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { provideBeadColors, type BeadColors } from '../../composables/palette/useBeadColors'
import { findBead } from '../../domain/beads'
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

describe('ColorPopover, picking (tickets 397, 398, 444)', () => {
  it('closes once a Palette color is picked, and once a Custom color is committed, after handing each on', async () => {
    const { wrapper, popover } = open(defaultPaletteIds())
    await wrapper.get('[data-color-id="blue"]').trigger('click')
    expect(popover.emitted('select-color')).toEqual([['blue']])
    expect(popover.emitted('close')).toHaveLength(1)

    await wrapper.get('[data-testid="custom-color-button"]').trigger('click')
    const field = wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
    await field.setValue('#123456')
    await field.trigger('keydown', { key: 'Enter' })
    expect(popover.emitted('select-custom-color')).toEqual([['#123456']])
    expect(popover.emitted('close')).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('ColorPopover, by keyboard (ticket 0857)', () => {
  const cleanups: (() => void)[] = []
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()))

  /** Opens the popover from a tile that holds focus, as the Tool pill's does. */
  function openFromTile(focusSwatch: boolean) {
    const tile = document.body.appendChild(document.createElement('button'))
    tile.focus()
    const host = mountWithPalette(ColorPopover, defaultPaletteIds(), { tile, pill: undefined, position: 'bottom', selectedColorId: 'blue', focusSwatch }, { attachTo: document.body })
    cleanups.push(() => {
      host.wrapper.unmount()
      tile.remove()
    })
    const swatches = () => host.wrapper.findAll<HTMLElement>('[data-testid="palette-swatch"]').map((swatch) => swatch.element)
    return { ...host, tile, swatches, popover: host.wrapper.findComponent(ColorPopover) }
  }

  it('walks in on the chosen swatch, steps with the arrows, chooses with Enter and gives focus back to the tile', () => {
    const { swatches, tile, popover } = openFromTile(true)
    const blue = swatches().findIndex((swatch) => swatch.dataset.colorId === 'blue')
    expect(document.activeElement).toBe(swatches()[blue])

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    const next = swatches()[blue + 1]!
    expect(document.activeElement).toBe(next)
    // Enter on a button is its click, with no pointer detail.
    ;(document.activeElement as HTMLElement).click()
    expect(popover.emitted('select-color')).toEqual([[next.dataset.colorId]])
    expect(popover.emitted('close')).toHaveLength(1)
    expect(document.activeElement).toBe(tile)
  })

  it('gives focus back to the tile on Escape', () => {
    const { tile, popover } = openFromTile(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(popover.emitted('close')).toHaveLength(1)
    expect(document.activeElement).toBe(tile)
  })

  it('takes no focus when opened by a pointer, and moves none on closing from outside it', () => {
    const { tile, popover } = openFromTile(false)
    expect(document.activeElement).toBe(tile)
    const elsewhere = document.body.appendChild(document.createElement('button'))
    cleanups.push(() => elsewhere.remove())
    elsewhere.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(popover.emitted('close')).toHaveLength(1)
    expect(document.activeElement).toBe(elsewhere)
  })
})

describe('ColorPopover, the Bead’s palette (ticket 0746)', () => {
  function withCatalog() {
    const colors = { available: ref(true), state: ref('ready'), swatches: ref([]), bead: ref(findBead('miyuki/delica/11-0')), catalog: ref(), load: vi.fn(), add: vi.fn() } as unknown as BeadColors
    const Wrapped = defineComponent(() => {
      provideBeadColors(colors)
      return () => h(ColorPopover, { tile: undefined, pill: undefined, position: 'bottom' })
    })
    const host = mountWithPalette(Wrapped, [...defaultPaletteIds(), added], {}, { attachTo: document.body })
    const popover = () => host.wrapper.get('[data-testid="color-popover"]')
    const grid = () => host.wrapper.get('[data-testid="palette-picker"]')
    return { ...host, popover, grid, toggle: () => host.wrapper.get('[data-testid="bead-colors-toggle"]').trigger('click') }
  }

  it('widens to the panel width while the list is open, and the Palette grid fills it; closing the list brings 288px back', async () => {
    const { wrapper, popover, grid, toggle } = withCatalog()
    expect(popover().classes()).not.toContain('color-popover--wide')

    await toggle()
    expect(popover().classes()).toContain('color-popover--wide')
    expect(grid().classes()).toContain('palette-picker--wide')

    await toggle()
    expect(popover().classes()).not.toContain('color-popover--wide')
    expect(grid().classes()).not.toContain('palette-picker--wide')
    wrapper.unmount()
  })

  it('goes back to 288px in Edit palette, where the list is not offered', async () => {
    const { wrapper, popover, toggle } = withCatalog()
    await toggle()

    await wrapper.get('[data-testid="color-popover-edit"]').trigger('click')

    expect(popover().classes()).not.toContain('color-popover--wide')
    wrapper.unmount()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { provideBeadColors, type BeadColors } from '../../composables/palette/useBeadColors'
import { findBead } from '../../domain/beads'
import { addedColorId, BUILT_IN_COLORS, defaultPaletteIds } from '../../domain/palette'
import { fillBlanks } from '../../domain/fillBlanks'
import { en } from '../../i18n/en'
import { mountWithPalette } from '../../testUtils/paletteHost'
import ColorPopover from './ColorPopover.vue'

const added = addedColorId('#123456')

function open(ids: string[] = [...defaultPaletteIds(), added]) {
  const host = mountWithPalette(ColorPopover, ids, { tile: undefined, pill: undefined, position: 'bottom' }, { attachTo: document.body })
  const pencil = () => host.wrapper.find('[data-testid="color-popover-edit"]')
  const escape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  return { ...host, pencil, escape, popover: host.wrapper.findComponent(ColorPopover) }
}

describe('ColorPopover, Edit palette (tickets 531, 0532, 1226)', () => {
  it('offers the pencil only while the Palette has a color', () => {
    const { wrapper, pencil } = open([])
    expect(pencil().exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens in normal mode; the pencil enters the mode and puts Remove section on each section', async () => {
    const { wrapper, pencil, requestRemoveSection } = open()
    expect(pencil().attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="palette-section-remove"]').exists()).toBe(false)
    await pencil().trigger('click')
    expect(pencil().attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-testid="palette-section-remove"]').trigger('click')
    expect(requestRemoveSection).toHaveBeenCalledWith('custom')
    wrapper.unmount()
  })

  it('turns the pencil into a check named Done editing while the mode is on (ticket 1092)', async () => {
    const { wrapper, pencil } = open()
    expect([pencil().attributes('aria-label'), pencil().get('svg').attributes('data-icon')]).toEqual(['Edit Palette', 'pencil'])
    await pencil().trigger('click')
    expect([pencil().attributes('aria-label'), pencil().get('svg').attributes('data-icon')]).toEqual(['Done editing', 'check'])
    wrapper.unmount()
  })

  it('offers the Palette\'s Letters switch where letters are handed out, and none where they are not (ticket 1092)', async () => {
    const shown = ref(false)
    const host = mountWithPalette(ColorPopover, defaultPaletteIds(), { tile: undefined, pill: undefined, position: 'bottom' }, { attachTo: document.body, letters: shown })
    const letters = host.wrapper.get('[data-testid="palette-letters"]')
    expect(letters.attributes('aria-checked')).toBe('false')
    await letters.trigger('click')
    expect(shown.value).toBe(true)
    host.wrapper.unmount()

    const bare = open()
    expect(bare.wrapper.find('[data-testid="palette-letters"]').exists()).toBe(false)
    bare.wrapper.unmount()
  })

  it('disables Add another color and Pick color in the mode, and shuts the popover it opened', async () => {
    const { wrapper, pencil } = open()
    await wrapper.get('[data-testid="add-color-button"]').trigger('click')
    expect(wrapper.find('[data-testid="add-color-popover"]').exists()).toBe(true)
    await pencil().trigger('click')
    for (const id of ['pick-color-button', 'add-color-button']) expect(wrapper.get(`[data-testid="${id}"]`).attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[data-testid="add-color-popover"]').exists()).toBe(false)
    await wrapper.get('[data-testid="add-color-button"]').trigger('click')
    expect(wrapper.find('[data-testid="add-color-popover"]').exists()).toBe(false)
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

  it('ends the mode with the last color, and the pencil goes', async () => {
    const { wrapper, pencil, palette } = open([added])
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

describe('ColorPopover, picking (tickets 397, 398, 444, 1226)', () => {
  it('closes once a Palette color is picked, after handing it on', async () => {
    const { wrapper, popover } = open(defaultPaletteIds())
    await wrapper.get('[data-color-id="blue"]').trigger('click')
    expect(popover.emitted('select-color')).toEqual([['blue']])
    expect(popover.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('hands a wheel color on at the + and stays open for the next, in the Add another color popover', async () => {
    const { wrapper, popover } = open(defaultPaletteIds())
    await wrapper.get('[data-testid="add-color-button"]').trigger('click')
    await wrapper.get('[data-testid="add-color-tabs"] [data-value="custom"]').trigger('click')
    await wrapper.get('[data-testid="custom-color-hex"]').setValue('#123456')
    await wrapper.get('[data-testid="custom-color-add"]').trigger('click')

    expect(popover.emitted('select-custom-color')).toEqual([['#123456']])
    expect(popover.emitted('close')).toBeUndefined()
    expect(wrapper.find('[data-testid="add-color-popover"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('adds the color on Enter in the hex field, and nothing after a mistyped one (ticket 0959)', async () => {
    const { wrapper, popover } = open(defaultPaletteIds())
    await wrapper.get('[data-testid="add-color-button"]').trigger('click')
    await wrapper.get('[data-testid="add-color-tabs"] [data-value="custom"]').trigger('click')
    const field = wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
    await field.setValue('#GGGGGG')
    await field.trigger('keydown', { key: 'Enter' })
    expect(popover.emitted()).not.toHaveProperty('select-custom-color')

    await field.setValue('#123456')
    await field.trigger('keydown', { key: 'Enter' })
    expect(popover.emitted('select-custom-color')).toEqual([['#123456']])
    expect(popover.emitted()).not.toHaveProperty('close')
    wrapper.unmount()
  })
})

describe('ColorPopover, by keyboard (ticket 0857)', () => {
  const cleanups: (() => void)[] = []
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()))

  /** Opens the popover from a tile that holds focus, as the Tool pill's does. */
  async function openFromTile(focusSwatch: boolean) {
    const pill = document.body.appendChild(document.createElement('div'))
    const tile = pill.appendChild(document.createElement('button'))
    tile.focus()
    const host = mountWithPalette(ColorPopover, defaultPaletteIds(), { tile, pill, position: 'bottom', selectedColorId: 'blue', focusSwatch }, { attachTo: document.body })
    cleanups.push(() => {
      host.wrapper.unmount()
      pill.remove()
    })
    // Focus goes in once the popover is placed beside the pill (ticket 0961).
    await flushPromises()
    const swatches = () => host.wrapper.findAll<HTMLElement>('[data-testid="palette-swatch"]').map((swatch) => swatch.element)
    return { ...host, tile, swatches, popover: host.wrapper.findComponent(ColorPopover) }
  }

  it('walks in on the chosen swatch, steps with the arrows, chooses with Enter and gives focus back to the tile', async () => {
    const { swatches, tile, popover } = await openFromTile(true)
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

  it('gives focus back to the tile on Escape', async () => {
    const { tile, popover } = await openFromTile(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(popover.emitted('close')).toHaveLength(1)
    expect(document.activeElement).toBe(tile)
  })

  it('takes no focus when opened by a pointer, and moves none on closing from outside it', async () => {
    const { tile, popover } = await openFromTile(false)
    expect(document.activeElement).toBe(tile)
    const elsewhere = document.body.appendChild(document.createElement('button'))
    cleanups.push(() => elsewhere.remove())
    elsewhere.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(popover.emitted('close')).toHaveLength(1)
    expect(document.activeElement).toBe(elsewhere)
  })
})

describe('ColorPopover, Add another color (ticket 1226)', () => {
  function withCatalog() {
    const chooser = { available: ref(true), state: ref('ready'), swatches: ref([]), bead: ref(findBead('miyuki/delica/11-0')), catalog: ref(), load: vi.fn(), add: vi.fn() }
    const colors = { ...chooser, chooser, chooseBead: vi.fn(), resetChooser: vi.fn() } as unknown as BeadColors
    const Wrapped = defineComponent(() => {
      provideBeadColors(colors)
      return () => h(ColorPopover, { tile: undefined, pill: undefined, position: 'bottom' })
    })
    const host = mountWithPalette(Wrapped, [...defaultPaletteIds(), added], {}, { attachTo: document.body })
    return { ...host, colors, add: () => host.wrapper.get('[data-testid="add-color-button"]').trigger('click') }
  }

  it('keeps the Palette popover its own width, and opens the other beside it on the Bead colors tab, starting on the Palette\'s Bead', async () => {
    const { wrapper, add, colors } = withCatalog()
    expect(wrapper.find('[data-testid="add-color-popover"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="add-color-button"]').attributes('aria-expanded')).toBe('false')

    await add()

    expect(wrapper.get('[data-testid="add-color-popover"]').attributes('role')).toBe('dialog')
    expect(wrapper.get('[data-testid="add-color-tabs"] [aria-checked="true"]').attributes('data-value')).toBe('bead')
    expect(wrapper.find('[data-testid="bead-colors"]').exists()).toBe(true)
    expect(colors.resetChooser).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="color-popover"]').classes()).not.toContain('color-popover--wide')
    wrapper.unmount()
  })

  it('asks the chooser for the Bead picked, and shuts alone on Escape or Close, leaving the Palette popover open', async () => {
    const { wrapper, add, colors } = withCatalog()
    await add()
    await wrapper.get('[data-testid="bead-brand"]').trigger('click')
    expect(colors.chooser!.load).toHaveBeenCalled()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="add-color-popover"]').exists()).toBe(false)
    expect(wrapper.findComponent(ColorPopover).emitted('close')).toBeUndefined()

    await add()
    await wrapper.get('[data-testid="add-color-close"]').trigger('click')
    expect(wrapper.find('[data-testid="add-color-popover"]').exists()).toBe(false)
    expect(wrapper.findComponent(ColorPopover).emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  const openCustom = async (host: ReturnType<typeof withCatalog>) => {
    await host.add()
    await host.wrapper.get('[data-testid="add-color-tabs"] [data-value="custom"]').trigger('click')
  }

  it('keeps the tab not shown in place and inert, the Custom color tab taking the focus on its wheel', async () => {
    const host = withCatalog()
    await openCustom(host)
    const bead = host.wrapper.get('[data-testid="add-color-panel-bead"]')
    expect(bead.attributes('inert')).toBeDefined()
    expect(bead.find('[data-testid="bead-colors"]').exists()).toBe(true)
    expect(host.wrapper.get('[data-testid="add-color-panel-custom"]').attributes('inert')).toBeUndefined()
    expect(document.activeElement?.getAttribute('data-testid')).toBe('custom-color-wheel')
    host.wrapper.unmount()
  })

  it('offers the twelve basic colors, a press taking one as the wheel\'s + does', async () => {
    const host = withCatalog()
    await openCustom(host)
    const swatches = host.wrapper.findAll('[data-testid="basic-color"]')
    expect(swatches).toHaveLength(12)
    // The twelve of this Palette are held already; the check says so.
    expect(swatches[0]!.find('[data-testid="swatch-held"]').exists()).toBe(true)
    expect(swatches[0]!.attributes('aria-label')).toBe(fillBlanks(en.palette.beadColors.heldLabel, { name: en.colorNames.black! }))
    await swatches[0]!.trigger('click')
    expect(host.wrapper.findComponent(ColorPopover).emitted('select-custom-color')).toEqual([[BUILT_IN_COLORS[0]!.hex]])
    expect(host.wrapper.get('[data-testid="basic-colors-add-all"]').attributes('aria-disabled')).toBe('true')
    host.wrapper.unmount()
  })

  it('adds every basic color the Palette lacks in one Edit, taking none as the paint color', async () => {
    const host = withCatalog()
    for (const color of BUILT_IN_COLORS.slice(0, 3)) host.palette.removeAdded(color.id)
    await openCustom(host)
    await host.wrapper.get('[data-testid="basic-colors-add-all"]').trigger('click')

    const held = host.palette.palette.value.colors.map((color) => color.hex)
    expect(held).toEqual(expect.arrayContaining(BUILT_IN_COLORS.map((color) => color.hex)))
    expect(new Set(held).size).toBe(held.length)
    expect(host.wrapper.findComponent(ColorPopover).emitted('select-custom-color')).toBeUndefined()
    host.harness.history.onUndo()
    expect(host.palette.palette.value.colors).toHaveLength(held.length - 3)
    host.wrapper.unmount()
  })

  it('tells a hex clash once, with the section and code it is a shade apart from, until the next add', async () => {
    const { wrapper, add, palette } = withCatalog()
    await add()
    expect(wrapper.find('[data-testid="add-color-nudge"]').exists()).toBe(false)

    palette.addUsed('#123456', { catalog: 'toho', code: '1' })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="add-color-nudge"]').text()).toBe(en.palette.nudgeCustom)

    palette.addUsed('#123457', { catalog: 'toho', code: '2' })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="add-color-nudge"]').text()).toBe(fillBlanks(en.palette.nudgeCoded, { section: 'TOHO', code: '1' }))

    palette.addUsed('#654321')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="add-color-nudge"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

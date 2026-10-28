import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PalettePicker from './PalettePicker.vue'
import { BUILT_IN_COLORS, addedColorId, defaultPaletteIds } from '../../domain/palette'
import { ru } from '../../i18n/ru'
import { mountWithPalette } from '../../testUtils/paletteHost'
import { fillBlanks } from '../../domain/fillBlanks'

const added = addedColorId('#123456')

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

describe('PalettePicker', () => {
  it('renders one swatch per palette color', () => {
    const wrapper = mount(PalettePicker)

    expect(wrapper.findAll('[data-testid="palette-swatch"]')).toHaveLength(BUILT_IN_COLORS.length)
  })

  it('emits select with the clicked color id', async () => {
    const wrapper = mount(PalettePicker)

    await wrapper.find(`[data-color-id="${BUILT_IN_COLORS[2]!.id}"]`).trigger('click')

    expect(wrapper.emitted('select')).toEqual([[BUILT_IN_COLORS[2]!.id]])
  })

  it('marks the selected color as pressed', () => {
    const wrapper = mount(PalettePicker, { props: { selectedColorId: BUILT_IN_COLORS[0]!.id } })

    const selected = wrapper.find(`[data-color-id="${BUILT_IN_COLORS[0]!.id}"]`)
    const other = wrapper.find(`[data-color-id="${BUILT_IN_COLORS[1]!.id}"]`)

    expect(selected.attributes('aria-pressed')).toBe('true')
    expect(other.attributes('aria-pressed')).toBe('false')
  })

  it('names each swatch "Цвет N, {name}" for screen readers (accessibility.md, ticket 165; mounted standalone falls back to Russian)', () => {
    const wrapper = mount(PalettePicker)

    const swatches = wrapper.findAll('[data-testid="palette-swatch"]')
    BUILT_IN_COLORS.forEach((color, index) => {
      expect(swatches[index]!.attributes('aria-label')).toBe(`${ru.palette.colorLabel} ${index + 1}, ${ru.colorNames[color.id]}`)
    })
  })

  it("shows the Shift+key of the first seven swatches, 4…9 then 0, since Shift+1…3 are the recents (tickets 88, 333, 529)", async () => {
    const wrapper = mount(PalettePicker)
    const shortcuts = ['4', '5', '6', '7', '8', '9', '0']

    const tooltips = wrapper.findAll('.app-tooltip')
    for (const [index, tooltip] of tooltips.entries()) {
      await tooltip.trigger('pointerenter', { pointerType: 'mouse' })
      if (index < shortcuts.length) expect(tooltip.get('.app-tooltip__key').text()).toBe(`Shift+${shortcuts[index]}`)
      else expect(tooltip.find('.app-tooltip__key').exists()).toBe(false)
    }
  })

  it('names the tooltip "Color" with the hex as its body (ticket 333)', async () => {
    const wrapper = mount(PalettePicker)
    const tooltip = wrapper.get('.app-tooltip')

    await tooltip.trigger('pointerenter', { pointerType: 'mouse' })

    expect(tooltip.get('.app-tooltip__name').text()).toBe(ru.palette.colorLabel)
    expect(tooltip.get('.app-tooltip__body').text()).toBe(BUILT_IN_COLORS[0]!.hex)
  })

  describe('Edit palette (ticket 531)', () => {
    it('locks every built-in swatch: faded, aria-disabled, no select, still focusable', async () => {
      const wrapper = mount(PalettePicker, { props: { editing: true }, attachTo: document.body })
      const first = wrapper.get('[data-testid="palette-swatch"]')

      expect(first.attributes('aria-disabled')).toBe('true')
      expect(first.attributes('tabindex')).toBeDefined()
      await first.trigger('click')
      expect(wrapper.emitted('select')).toBeUndefined()
      expect(wrapper.findAll('.swatch--locked')).toHaveLength(BUILT_IN_COLORS.length)
      expect(wrapper.find('[data-testid="palette-swatch-remove"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('says why a built-in swatch is locked, as its description', async () => {
      const wrapper = mount(PalettePicker, { props: { editing: true } })
      await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })

      expect(wrapper.get('.app-tooltip__body').text()).toBe(ru.palette.defaultColorLocked)
    })

    it('leaves the swatches alone outside the mode', () => {
      const wrapper = mount(PalettePicker)

      expect(wrapper.find('[aria-disabled="true"]').exists()).toBe(false)
      expect(wrapper.find('.swatch--locked').exists()).toBe(false)
    })

    it('shows a × on an added swatch only in the mode, named for its hex, and a press asks to remove it (tickets 228, 304)', async () => {
      const outside = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added])
      expect(outside.wrapper.find('[data-testid="palette-swatch-remove"]').exists()).toBe(false)

      const { wrapper, requestRemove } = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added], { editing: true })
      expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(1)
      const swatch = wrapper.get(`[data-color-id="${added}"]`)
      expect(swatch.attributes('aria-label')).toBe(fillBlanks(ru.palette.removeSwatch, { hex: '#123456' }))
      await swatch.trigger('click')
      expect(requestRemove).toHaveBeenCalledWith(added)
      expect(wrapper.findComponent(PalettePicker).emitted('select')).toBeUndefined()
    })
  })

  it('asks to remove a focused added swatch on Delete or Backspace, and not a built-in one (ticket 228)', async () => {
    const { wrapper, requestRemove } = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added])

    await wrapper.get(`[data-color-id="${BUILT_IN_COLORS[0]!.id}"]`).trigger('keydown', { key: 'Delete' })
    expect(requestRemove).not.toHaveBeenCalled()
    await wrapper.get(`[data-color-id="${added}"]`).trigger('keydown', { key: 'Backspace' })
    expect(requestRemove).toHaveBeenCalledWith(added)
  })

  it('moves a swatch one slot with Alt+Right (ticket 398)', async () => {
    const { wrapper, harness } = mountWithPalette(PalettePicker, defaultPaletteIds(), {}, { attachTo: document.body })
    const [first, second, ...rest] = defaultPaletteIds()

    await wrapper.get(`[data-color-id="${first}"]`).trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(harness.project.palette).toEqual([second, first, ...rest])
    wrapper.unmount()
  })
})

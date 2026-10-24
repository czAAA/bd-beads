import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PalettePicker from './PalettePicker.vue'
import { BUILT_IN_COLORS } from '../../domain/palette'
import { ru } from '../../i18n/ru'

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
  })
})

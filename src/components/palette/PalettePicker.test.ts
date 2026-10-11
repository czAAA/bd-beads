import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PalettePicker from './PalettePicker.vue'
import { PALETTE } from '../../domain/palette'
import { ru } from '../../i18n/ru'

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

describe('PalettePicker', () => {
  it('renders one swatch per palette color', () => {
    const wrapper = mount(PalettePicker)

    expect(wrapper.findAll('[data-testid="palette-swatch"]')).toHaveLength(PALETTE.length)
  })

  it('emits select with the clicked color id', async () => {
    const wrapper = mount(PalettePicker)

    await wrapper.find(`[data-color-id="${PALETTE[2]!.id}"]`).trigger('click')

    expect(wrapper.emitted('select')).toEqual([[PALETTE[2]!.id]])
  })

  it('marks the selected color as pressed', () => {
    const wrapper = mount(PalettePicker, { props: { selectedColorId: PALETTE[0]!.id } })

    const selected = wrapper.find(`[data-color-id="${PALETTE[0]!.id}"]`)
    const other = wrapper.find(`[data-color-id="${PALETTE[1]!.id}"]`)

    expect(selected.attributes('aria-pressed')).toBe('true')
    expect(other.attributes('aria-pressed')).toBe('false')
  })

  it('names each swatch "Цвет N, {name}" for screen readers (accessibility.md, ticket 165; mounted standalone falls back to Russian)', () => {
    const wrapper = mount(PalettePicker)

    const swatches = wrapper.findAll('[data-testid="palette-swatch"]')
    PALETTE.forEach((color, index) => {
      expect(swatches[index]!.attributes('aria-label')).toBe(`${ru.palette.colorLabel} ${index + 1}, ${ru.colorNames[color.id]}`)
    })
  })

  it("shows each swatch's Shift+key shortcut as the key chip of its tooltip, in Palette order (tickets 88, 333)", async () => {
    const wrapper = mount(PalettePicker)
    const shortcuts = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Q', 'W']

    const tooltips = wrapper.findAll('.app-tooltip')
    for (const [index, tooltip] of tooltips.entries()) {
      await tooltip.trigger('pointerenter', { pointerType: 'mouse' })
      expect(tooltip.get('.app-tooltip__key').text()).toBe(`Shift+${shortcuts[index]}`)
    }
  })

  it('names the tooltip "Color" with the hex as its body (ticket 333)', async () => {
    const wrapper = mount(PalettePicker)
    const tooltip = wrapper.get('.app-tooltip')

    await tooltip.trigger('pointerenter', { pointerType: 'mouse' })

    expect(tooltip.get('.app-tooltip__name').text()).toBe(ru.palette.colorLabel)
    expect(tooltip.get('.app-tooltip__body').text()).toBe(PALETTE[0]!.hex)
  })
})

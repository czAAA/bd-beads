import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PalettePicker from './PalettePicker.vue'
import { PALETTE } from '../domain/palette'

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
})

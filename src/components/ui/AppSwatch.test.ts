import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppSwatch from './AppSwatch.vue'

const props = { color: '#6b3fa0', label: 'Color 3, violet' }

describe('AppSwatch', () => {
  it('is a toggle button that keeps its name and emits select', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, selected: true } })
    const chip = wrapper.get('button')

    expect(chip.attributes('aria-label')).toBe('Color 3, violet')
    expect(chip.attributes('aria-pressed')).toBe('true')
    await chip.trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('is a radio when asked, with aria-checked in place of aria-pressed', () => {
    const chip = mount(AppSwatch, { props: { ...props, role: 'radio' } }).get('button')

    expect(chip.attributes('role')).toBe('radio')
    expect(chip.attributes('aria-checked')).toBe('false')
    expect(chip.attributes('aria-pressed')).toBeUndefined()
  })

  it('shows "Color", the hex and the key chip in its Tooltip', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, hotkey: 'Shift+3' } })
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })

    expect(wrapper.get('.app-tooltip__name').text()).toBe('Color')
    expect(wrapper.get('.app-tooltip__body').text()).toBe('#6b3fa0')
    expect(wrapper.get('.app-tooltip__key').text()).toBe('Shift+3')
  })

  it('has no key chip without a hotkey', async () => {
    const wrapper = mount(AppSwatch, { props })
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })

    expect(wrapper.find('.app-tooltip__key').exists()).toBe(false)
  })

  it('offers the × only while selected, and asks to remove', async () => {
    const idle = mount(AppSwatch, { props: { ...props, removeLabel: 'Remove' } })
    expect(idle.find('.swatch__remove').exists()).toBe(false)

    const wrapper = mount(AppSwatch, { props: { ...props, selected: true, removeLabel: 'Remove' } })
    await wrapper.get('.swatch__remove').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('draws the × in the mark that reads on its color', () => {
    const dark = mount(AppSwatch, { props: { ...props, color: '#1a1a1a', selected: true, removeLabel: 'Remove' } })
    const light = mount(AppSwatch, { props: { ...props, color: '#fafafa', selected: true, removeLabel: 'Remove' } })

    expect(dark.get('.swatch__remove').classes()).toContain('swatch__remove--canvas')
    expect(light.get('.swatch__remove').classes()).toContain('swatch__remove--ink')
  })
})

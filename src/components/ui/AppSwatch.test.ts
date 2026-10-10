import { describe, expect, it, vi } from 'vitest'
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

  it('selects on the first click even when it lands on a hovered ×, and removes only once selected', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, removeLabel: 'Remove' } })
    await wrapper.get('.swatch').trigger('pointerenter', { pointerType: 'mouse' })
    await wrapper.get('.swatch__remove').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toBeUndefined()

    await wrapper.setProps({ selected: true })
    await wrapper.get('.swatch__remove').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('draws the × black on a light swatch and white on a dark one, in any theme', () => {
    const dark = mount(AppSwatch, { props: { ...props, color: '#1a1a1a', selected: true, removeLabel: 'Remove' } })
    const light = mount(AppSwatch, { props: { ...props, color: '#fafafa', selected: true, removeLabel: 'Remove' } })

    expect(dark.get('.swatch__remove').classes()).toContain('swatch__remove--light')
    expect(light.get('.swatch__remove').classes()).toContain('swatch__remove--dark')
  })

  it('shows the × on the active swatch and while a mouse or pen hovers an added one, never on touch', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, removeLabel: 'Remove' } })
    const hover = (type: string, pointerType: string) => wrapper.get('.swatch').trigger(type, { pointerType })
    expect(wrapper.find('.swatch__remove').exists()).toBe(false)

    await hover('pointerenter', 'touch')
    expect(wrapper.find('.swatch__remove').exists()).toBe(false)
    await hover('pointerenter', 'mouse')
    expect(wrapper.find('.swatch__remove').exists()).toBe(true)
    await hover('pointerleave', 'mouse')
    expect(wrapper.find('.swatch__remove').exists()).toBe(false)
    await hover('pointerenter', 'pen')
    expect(wrapper.find('.swatch__remove').exists()).toBe(true)

    await wrapper.setProps({ selected: true })
    await hover('pointerleave', 'pen')
    expect(wrapper.find('.swatch__remove').exists()).toBe(true)
  })

  it('shows the × while keyboard focus is on the swatch', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, removeLabel: 'Remove' }, attachTo: document.body })
    const chip = wrapper.get('.swatch__chip')
    const matches = vi.spyOn(chip.element, 'matches').mockReturnValue(true)
    await chip.trigger('focusin')
    expect(wrapper.find('.swatch__remove').exists()).toBe(true)
    await chip.trigger('focusout')
    expect(wrapper.find('.swatch__remove').exists()).toBe(false)
    matches.mockReturnValue(false)
    await chip.trigger('focusin')
    expect(wrapper.find('.swatch__remove').exists()).toBe(false)
  })

  it('has no × without a remove label, even hovered or selected', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, selected: true } })
    await wrapper.get('.swatch').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.find('.swatch__remove').exists()).toBe(false)
  })
})

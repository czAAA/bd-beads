import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  it('shows no × at rest, hovered, selected or focused', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, selected: true } })
    await wrapper.get('.swatch').trigger('pointerenter', { pointerType: 'mouse' })
    await wrapper.get('.swatch__chip').trigger('focusin')

    expect(wrapper.find('.swatch__remove').exists()).toBe(false)
  })

  it('shows a centered × picture when removable, with the chip as the only button', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, removable: true, selected: true } })
    const mark = wrapper.get('.swatch__remove')

    expect(mark.element.tagName).toBe('SPAN')
    expect(mark.attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.get('button').attributes('aria-pressed')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('draws the × black on a light swatch and white on a dark one, in any theme', () => {
    const dark = mount(AppSwatch, { props: { ...props, color: '#1a1a1a', removable: true } })
    const light = mount(AppSwatch, { props: { ...props, color: '#fafafa', removable: true } })

    expect(dark.get('.swatch__remove').classes()).toContain('swatch__remove--light')
    expect(light.get('.swatch__remove').classes()).toContain('swatch__remove--dark')
  })

  it('fades a locked swatch, marks it aria-disabled and says why in its Tooltip, which describes it', async () => {
    const wrapper = mount(AppSwatch, { props: { ...props, lockedBody: "Default colors can't be removed." } })
    const chip = wrapper.get('button')
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })

    expect(wrapper.classes()).toContain('swatch--locked')
    expect(chip.attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('.app-tooltip__body').text()).toBe("Default colors can't be removed.")
    expect(chip.attributes('aria-describedby')).toBeTruthy()
  })

  it('fades in the ×, and not under reduced motion', () => {
    const css = readFileSync(resolve(__dirname, 'AppSwatch.vue'), 'utf8')
    expect(css).toMatch(/\.swatch__remove \{[^}]*animation: swatch-remove-in var\(--duration-fast\)/)
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.swatch__remove \{\s*animation: none/)
  })
})

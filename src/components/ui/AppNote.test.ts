import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppNote from './AppNote.vue'

describe('AppNote', () => {
  it('shows its text as a plain paragraph, with no button or icon', () => {
    const wrapper = mount(AppNote, { slots: { default: 'Helper text' }, attrs: { 'data-testid': 'a-note' } })

    expect(wrapper.element.tagName).toBe('P')
    expect(wrapper.text()).toBe('Helper text')
    expect(wrapper.find('button, svg').exists()).toBe(false)
    expect(wrapper.attributes('data-testid')).toBe('a-note')
  })
})

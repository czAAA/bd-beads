import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NamesSection from './NamesSection.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

describe('NamesSection (ticket 568)', () => {
  it('shows two open fields by default and reports what is typed', async () => {
    const wrapper = mount(NamesSection, { props: { name: '', makerName: '', namePlaceholder: 'Delica' } })

    expect(wrapper.get('[data-testid="name-input"]').attributes('placeholder')).toBe('Delica')
    await wrapper.get('[data-testid="name-input"]').setValue('Moth')
    await wrapper.get('[data-testid="maker-name-input"]').setValue('Ada')
    expect(wrapper.emitted('update:name')).toEqual([['Moth']])
    expect(wrapper.emitted('update:makerName')).toEqual([['Ada']])
    expect(wrapper.find('[data-testid="project-name-edit"]').exists()).toBe(false)
  })

  it('inline shows each name as a line with a pencil, saved at once, and will not save an empty Name', async () => {
    const wrapper = mount(NamesSection, { props: { name: 'Moth', makerName: '', inline: true } })

    expect(wrapper.get('[data-testid="project-name"]').text()).toBe('Moth')
    expect(wrapper.find('[data-testid="name-input"]').exists()).toBe(false)
    await wrapper.get('[data-testid="project-name-edit"]').trigger('click')
    await wrapper.get('[data-testid="project-name-input"]').setValue('')
    await wrapper.get('[data-testid="project-name-save"]').trigger('click')
    expect(wrapper.get('[data-testid="project-name-save"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.emitted('update:name')).toBeUndefined()

    await wrapper.get('[data-testid="project-name-input"]').setValue('Heron')
    await wrapper.get('[data-testid="project-name-save"]').trigger('click')
    expect(wrapper.emitted('update:name')).toEqual([['Heron']])

    await wrapper.get('[data-testid="project-maker-add"]').trigger('click')
    await wrapper.get('[data-testid="project-maker-input"]').setValue('Ada')
    await wrapper.get('[data-testid="project-maker-save"]').trigger('click')
    expect(wrapper.emitted('update:makerName')).toEqual([['Ada']])
  })
})

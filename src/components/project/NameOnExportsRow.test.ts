import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NameOnExportsRow from './NameOnExportsRow.vue'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

describe('NameOnExportsRow (ADR 0060, ticket 443)', () => {
  it('unset: an open field with the label, placeholder, counter and hint, and no pencil', () => {
    const wrapper = mount(NameOnExportsRow, { props: { name: '' } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="maker-name-input"]')
    expect(input.attributes('placeholder')).toBe(en.saveBox.yourName)
    expect(input.attributes('maxlength')).toBe('40')
    expect(wrapper.text()).toContain(en.saveBox.nameOnExports)
    expect(wrapper.text()).toContain('0/40')
    expect(wrapper.text()).toContain(en.saveBox.nameHint)
    expect(wrapper.find('[data-testid="name-on-exports-change"]').exists()).toBe(false)
  })

  it('unset: Enter saves the trimmed name, and leaving an empty field saves nothing', async () => {
    const wrapper = mount(NameOnExportsRow, { props: { name: '' } })
    await wrapper.get('[data-testid="maker-name-input"]').trigger('blur')
    expect(wrapper.emitted('save')).toBeUndefined()

    await wrapper.get('[data-testid="maker-name-input"]').setValue('  Maria ')
    await wrapper.get('[data-testid="maker-name-input"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('save')).toEqual([['Maria']])
  })

  it('set: the name and a pencil named for the row; the pencil swaps the name for the field, and an empty field clears it', async () => {
    const wrapper = mount(NameOnExportsRow, { props: { name: 'Maria' }, attachTo: document.body })
    expect(wrapper.get('[data-testid="name-on-exports-value"]').text()).toBe('Maria')
    expect(wrapper.find('[data-testid="maker-name-input"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="name-on-exports-change"]').attributes('aria-label')).toBe(en.panels.project.editNameOnExports)

    await wrapper.get('[data-testid="name-on-exports-change"]').trigger('click')
    expect(wrapper.get<HTMLInputElement>('[data-testid="maker-name-input"]').element.value).toBe('Maria')
    await wrapper.get('[data-testid="maker-name-input"]').setValue('')
    await wrapper.get('[data-testid="maker-name-input"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('save')).toEqual([['']])
    wrapper.unmount()
  })

  it('set: leaving the field unchanged saves nothing', async () => {
    const wrapper = mount(NameOnExportsRow, { props: { name: 'Maria' } })
    await wrapper.get('[data-testid="name-on-exports-change"]').trigger('click')
    await wrapper.get('[data-testid="maker-name-input"]').trigger('blur')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.find('[data-testid="name-on-exports-value"]').exists()).toBe(true)
  })
})

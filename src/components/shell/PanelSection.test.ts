import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PanelSection from './PanelSection.vue'

beforeEach(() => localStorage.clear())

const mountSection = (props: Record<string, unknown> = {}) => mount(PanelSection, { props: { label: 'Project', id: 'project:bead', ...props }, slots: { default: '<p data-testid="row">row</p>' } })

describe('PanelSection (ticket 0553)', () => {
  it('is open on a first visit, a group named by its header button', () => {
    const wrapper = mountSection()
    const header = wrapper.get('button')
    expect(header.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="group"]').attributes('aria-labelledby')).toBe(header.attributes('id'))
    expect(wrapper.find('[data-testid="row"]').exists()).toBe(true)
  })

  it('folds shut and open again, remembering per section on this device', async () => {
    const wrapper = mountSection()
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('[data-testid="row"]').exists()).toBe(false)
    expect(localStorage.getItem('openbeads:panel-sections-closed')).toBe('project:bead')
    expect(mountSection({ id: 'project:other' }).find('[data-testid="row"]').exists()).toBe(true)
    expect(mountSection().find('[data-testid="row"]').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(localStorage.getItem('openbeads:panel-sections-closed')).toBeNull()
  })

  it('shows its summary beside the chevron once folded', async () => {
    const wrapper = mountSection({ summary: 'Delica 11/0' })
    expect(wrapper.text()).not.toContain('Delica 11/0')
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('Delica 11/0')
  })
})

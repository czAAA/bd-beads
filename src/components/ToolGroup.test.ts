import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolGroup from './ToolGroup.vue'

describe('ToolGroup', () => {
  it('shows the given title, in the group’s top-left corner', () => {
    const wrapper = mount(ToolGroup, { props: { title: 'Tools' } })

    expect(wrapper.text()).toContain('Tools')
  })

  it('names the group for screen readers via its visible title, not a separate duplicate string', () => {
    const wrapper = mount(ToolGroup, { props: { title: 'Mirror' } })

    const labelledBy = wrapper.attributes('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(wrapper.find(`#${labelledBy}`).text()).toBe('Mirror')
  })

  it('gives each instance its own title id, so several groups on one page never collide', () => {
    const wrapper = mount({
      components: { ToolGroup },
      template: `
        <ToolGroup title="Tools" data-testid="a" />
        <ToolGroup title="Edit" data-testid="b" />
      `,
    })

    const [a, b] = wrapper.findAll('.tool-group')
    expect(a!.attributes('aria-labelledby')).not.toBe(b!.attributes('aria-labelledby'))
  })

  it('renders its slot content', () => {
    const wrapper = mount(ToolGroup, {
      props: { title: 'Edit' },
      slots: { default: '<button data-testid="stub-control">Undo</button>' },
    })

    expect(wrapper.find('[data-testid="stub-control"]').exists()).toBe(true)
  })

  it('passes attributes like data-testid through to its root element', () => {
    const wrapper = mount(ToolGroup, {
      props: { title: 'Edit' },
      attrs: { 'data-testid': 'tool-group-edit' },
    })

    expect(wrapper.attributes('data-testid')).toBe('tool-group-edit')
  })
})

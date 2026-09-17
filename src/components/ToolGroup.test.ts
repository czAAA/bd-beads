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

/** A slot of `count` plain stub buttons, `control-0`..`control-(count-1)`, in order — no group today holds more than 14, so overflow behavior can only be exercised by feeding a group more than that (ticket 41). */
function controlsSlot(count: number): string {
  return Array.from({ length: count }, (_, i) => `<button data-testid="control-${i}">${i}</button>`).join('')
}

function mountWithControls(count: number) {
  return mount(ToolGroup, {
    props: { title: 'Tools' },
    slots: { default: controlsSlot(count) },
  })
}

describe('ToolGroup expand in place (ticket 41)', () => {
  it('shows no chevron for a group with exactly 14 controls, and never expands it on hover', async () => {
    const wrapper = mountWithControls(14)

    expect(wrapper.find('[data-testid="tool-group-chevron"]').exists()).toBe(false)

    await wrapper.trigger('mouseenter')

    expect(wrapper.find('[data-testid="tool-group-overflow"]').exists()).toBe(false)
    for (let i = 0; i < 14; i++) {
      expect(wrapper.find(`[data-testid="control-${i}"]`).exists()).toBe(true)
    }
  })

  it('shows only the first 14 controls plus a chevron for a group with more than 14', () => {
    const wrapper = mountWithControls(15)

    expect(wrapper.find('[data-testid="tool-group-chevron"]').exists()).toBe(true)
    for (let i = 0; i < 14; i++) {
      expect(wrapper.find(`[data-testid="control-${i}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-testid="control-14"]').exists()).toBe(false)
  })

  it('expands to show every control, overlaying rather than replacing the first 14, when the pointer enters', async () => {
    const wrapper = mountWithControls(16)

    await wrapper.trigger('mouseenter')

    for (let i = 0; i < 16; i++) {
      expect(wrapper.find(`[data-testid="control-${i}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-testid="tool-group-overflow"]').exists()).toBe(true)
  })

  it('collapses back to 14 when the pointer leaves', async () => {
    const wrapper = mountWithControls(15)

    await wrapper.trigger('mouseenter')
    expect(wrapper.find('[data-testid="control-14"]').exists()).toBe(true)

    await wrapper.trigger('mouseleave')

    expect(wrapper.find('[data-testid="control-14"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tool-group-overflow"]').exists()).toBe(false)
  })

  it('exposes its expanded state and a collapse() that App.vue calls for Escape, ahead of Paste-cancel/Selection-clear', async () => {
    const wrapper = mountWithControls(15)

    await wrapper.trigger('mouseenter')
    expect(wrapper.vm.expanded).toBe(true)

    // Escape reaches this via Toolbox's collapseExpandedGroup (see Toolbox.vue/App.vue) rather than a keydown
    // listener of its own here, so this is what that call site exercises.
    const wasExpanded = wrapper.vm.collapse()
    await wrapper.vm.$nextTick()

    expect(wasExpanded).toBe(true)
    expect(wrapper.vm.expanded).toBe(false)
    expect(wrapper.find('[data-testid="control-14"]').exists()).toBe(false)
  })

  it('collapse() is a harmless no-op, reporting nothing changed, when the group is already collapsed', () => {
    const wrapper = mountWithControls(15)

    expect(wrapper.vm.collapse()).toBe(false)
    expect(wrapper.vm.expanded).toBe(false)
  })

  it('keeps a full-row control (e.g. Row progress’s readout) out of the 14-slot count', () => {
    const wrapper = mount(ToolGroup, {
      props: { title: 'Row progress' },
      slots: {
        default: `
          ${controlsSlot(14)}
          <p class="tool-group__full-row" data-testid="readout">readout</p>
        `,
      },
    })

    // 14 normal controls plus one full-row readout: still no overflow, and the readout itself is always shown.
    expect(wrapper.find('[data-testid="tool-group-chevron"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="readout"]').exists()).toBe(true)
  })
})

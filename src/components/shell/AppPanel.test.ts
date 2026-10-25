import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, inject, nextTick } from 'vue'
import AppPanel from './AppPanel.vue'
import { PANEL_CONTEXT } from './panelContext'

/** The shell's subpanel (spec 0478): Back, title swap, reset, Escape levels, focus. */

const Root = defineComponent({
  setup() {
    const context = inject(PANEL_CONTEXT)!
    return () => h('button', { type: 'button', 'data-testid': 'root-row', onClick: () => context.openSub() }, 'Row')
  },
})

function mountShell(props: Record<string, unknown> = {}) {
  return mount(AppPanel, {
    attachTo: document.body,
    props: { title: 'Menu', anchor: 'strip-menu', subTitle: 'New Project', ...props },
    slots: {
      default: () => h(Root),
      sub: () => h('input', { 'data-testid': 'field' }),
      footer: () => h('button', { type: 'submit', 'data-testid': 'create' }, 'Create'),
    },
  })
}

const escape = async () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AppSubpanel', () => {
  it('swaps the body for the subpanel under a Back arrow and its title, with the footer pinned', async () => {
    const wrapper = mountShell()
    expect(wrapper.find('[data-testid="panel-back"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="panel-footer"]').exists()).toBe(false)

    await wrapper.get('[data-testid="root-row"]').trigger('click')
    await nextTick()

    expect(wrapper.get('[data-testid="panel-sub-title"]').text()).toBe('New Project')
    expect(wrapper.find('[data-testid="root-row"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="panel-footer"]').find('[data-testid="create"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="panel-body"]').find('[data-testid="create"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-testid="field"]').element)
  })

  it('goes back with the arrow or Escape, focusing the row it came from, and closes on the next Escape', async () => {
    const wrapper = mountShell()
    const row = () => wrapper.get('[data-testid="root-row"]').element
    ;(row() as HTMLElement).focus()
    await wrapper.get('[data-testid="root-row"]').trigger('click')
    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(row())

    await wrapper.get('[data-testid="root-row"]').trigger('click')
    await escape()
    expect(wrapper.find('[data-testid="root-row"]').exists()).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()

    await escape()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('opens on the subpanel when asked and then closes on Escape instead of going back', async () => {
    const wrapper = mountShell({ startInSub: true })
    await nextTick()
    expect(wrapper.find('[data-testid="field"]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('[data-testid="field"]').element)

    await escape()
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    expect(wrapper.find('[data-testid="root-row"]').exists()).toBe(true)
  })

  it('resets to the root when the panel is swapped to another', async () => {
    const wrapper = mountShell()
    await wrapper.get('[data-testid="root-row"]').trigger('click')
    await wrapper.setProps({ anchor: 'strip-project' })
    expect(wrapper.find('[data-testid="root-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-back"]').exists()).toBe(false)
  })

  it('stacks subpanels: a second level has its own title, and Back and Escape pop one level at a time', async () => {
    const Deeper = defineComponent({
      setup() {
        const context = inject(PANEL_CONTEXT)!
        return () => h('button', { type: 'button', 'data-testid': 'deeper-row', onClick: () => context.openSub('Setup') }, 'Deeper')
      },
    })
    const wrapper = mount(AppPanel, {
      attachTo: document.body,
      props: { title: 'Menu', anchor: 'strip-menu', subTitle: 'New Project' },
      slots: {
        default: () => h(Root),
        sub: (slot: { depth: number }) => (slot.depth === 1 ? h(Deeper) : h('input', { 'data-testid': 'setup-field' })),
      },
    })
    await wrapper.get('[data-testid="root-row"]').trigger('click')
    ;(wrapper.get('[data-testid="deeper-row"]').element as HTMLElement).focus()
    await wrapper.get('[data-testid="deeper-row"]').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="panel-sub-title"]').text()).toBe('Setup')
    expect(document.activeElement).toBe(wrapper.get('[data-testid="setup-field"]').element)

    await escape()
    expect(wrapper.get('[data-testid="panel-sub-title"]').text()).toBe('New Project')
    expect(document.activeElement).toBe(wrapper.get('[data-testid="deeper-row"]').element)

    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    expect(wrapper.find('[data-testid="root-row"]').exists()).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

describe('the open Menu keeps focus (ticket 563, ADR 0075)', () => {
  const tab = (target: Element, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    return event
  }
  const mountRows = (props: Record<string, unknown>) =>
    mount(AppPanel, {
      attachTo: document.body,
      props: { title: 'Menu', anchor: 'strip-menu', ...props },
      slots: { default: () => [h('button', { type: 'button', 'data-testid': 'first' }, 'One'), h('button', { type: 'button', 'data-testid': 'second' }, 'Two'), h('button', { type: 'button', 'data-testid': 'last' }, 'Three')] },
    })

  it('wraps Tab from the last item to the first, and Shift+Tab back', () => {
    const wrapper = mountRows({ menu: true })
    const first = wrapper.get('[data-testid="first"]').element
    const last = wrapper.get('[data-testid="last"]').element
    expect(tab(last).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    expect(tab(first, true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('leaves Tab to the browser between the items, and everywhere outside the Menu', () => {
    const menu = mountRows({ menu: true })
    expect(tab(menu.get('[data-testid="second"]').element).defaultPrevented).toBe(false)
    menu.unmount()
    const project = mountRows({})
    expect(tab(project.get('[data-testid="last"]').element).defaultPrevented).toBe(false)
  })
})

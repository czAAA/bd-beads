import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppMessage from './AppMessage.vue'

describe('AppMessage', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['success', 'check', 'status'],
    ['info', 'info', 'status'],
    ['warning', 'warning', 'status'],
    ['danger', 'warning', 'alert'],
  ] as const)('a %s message has its tone edge, a 16px %s icon and role %s', (tone, icon, role) => {
    const wrapper = mount(AppMessage, { props: { tone }, slots: { default: 'Saved' } })

    expect(wrapper.classes()).toContain(`app-message--${tone}`)
    expect(wrapper.find(`[data-icon="${icon}"]`).exists()).toBe(true)
    expect(wrapper.attributes('role')).toBe(role)
    expect(wrapper.text()).toContain('Saved')
  })

  it('has a close × that says what it does, unless it is not closable', async () => {
    const wrapper = mount(AppMessage, { slots: { default: 'Saved' } })
    const close = wrapper.find('[data-testid="message-close"]')

    expect(close.attributes('aria-label')).toBe('Close')
    await close.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    expect(mount(AppMessage, { props: { closable: false } }).find('[data-testid="message-close"]').exists()).toBe(false)
  })

  it('shows its actions', () => {
    const wrapper = mount(AppMessage, { slots: { default: 'Couldn’t save', actions: '<button>Export Pattern</button>' } })

    expect(wrapper.find('.app-message__actions').text()).toBe('Export Pattern')
  })

  it('goes by itself after its timeout', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AppMessage, { props: { timeout: 5000 } })

    vi.advanceTimersByTime(4999)
    expect(wrapper.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stays while hovered or focused, and starts its clock again once left', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AppMessage, { props: { timeout: 5000 } })

    await wrapper.trigger('pointerenter')
    vi.advanceTimersByTime(10000)
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.trigger('focusin')
    await wrapper.trigger('pointerleave')
    vi.advanceTimersByTime(10000)
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.trigger('focusout')
    vi.advanceTimersByTime(5000)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('never goes by itself without a timeout', () => {
    vi.useFakeTimers()
    const wrapper = mount(AppMessage, { props: { tone: 'danger' } })

    vi.advanceTimersByTime(60000)
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

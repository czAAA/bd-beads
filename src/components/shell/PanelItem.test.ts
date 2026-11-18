import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PanelItem from './PanelItem.vue'
import { PANEL_CONTEXT } from './panelContext'

function mountItem(props: Record<string, unknown>) {
  const close = vi.fn()
  const wrapper = mount(PanelItem, { props, slots: { default: 'Export' }, global: { provide: { [PANEL_CONTEXT as symbol]: { close, openSub: vi.fn() } } } })
  return { wrapper, close }
}

describe('PanelItem', () => {
  it('closes its panel when pressed, unless it stays', async () => {
    const { wrapper, close } = mountItem({})
    await wrapper.get('button').trigger('click')
    expect(close).toHaveBeenCalledOnce()
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('unfolds rows under it with the fold mark, says so, and never closes its panel (ticket 1058)', async () => {
    const { wrapper, close } = mountItem({ expanded: false })
    const button = wrapper.get('button')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.find('.panel-item__mark--sub').exists()).toBe(true)

    await button.trigger('click')
    expect(close).not.toHaveBeenCalled()
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.setProps({ expanded: true })
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.find('.panel-item__mark').exists()).toBe(true)
    expect(button.find('.panel-item__mark--sub').exists()).toBe(false)
  })

  it('is no fold when not given one: no aria-expanded and no mark', () => {
    const { wrapper } = mountItem({})
    expect(wrapper.get('button').attributes('aria-expanded')).toBeUndefined()
    expect(wrapper.find('.panel-item__mark').exists()).toBe(false)
  })
})

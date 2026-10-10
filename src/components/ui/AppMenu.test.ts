import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import AppMenu from './AppMenu.vue'
import AppMenuItem from './AppMenuItem.vue'

function mountMenu(onSelect = vi.fn()) {
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          AppMenu,
          { label: 'Export', icon: 'export' },
          {
            default: () => [
              h(AppMenuItem, { icon: 'image', 'data-testid': 'qr', onSelect: () => onSelect('qr') }, () => 'PNG image'),
              h(AppMenuItem, { icon: 'image', disabled: true, 'data-testid': 'png' }, () => 'PNG image'),
              h(AppMenuItem, { icon: 'pdf', 'data-testid': 'pdf', onSelect: () => onSelect('pdf') }, () => 'PDF'),
            ],
            footer: () => h('p', { 'data-testid': 'footer' }, 'name on exports'),
          },
        )
    },
  })
  return mount(Host, { attachTo: document.body })
}

function key(target: Element, name: string) {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('AppMenu', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('opens under its button on a click and reports it', async () => {
    const wrapper = mountMenu()
    const button = wrapper.find('[aria-haspopup="menu"]')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await button.trigger('click')

    expect(button.attributes('aria-expanded')).toBe('true')
    const menu = wrapper.find('[role="menu"]')
    expect(menu.findAll('[role="menuitem"]')).toHaveLength(3)
    expect(menu.find('[data-testid="footer"]').exists()).toBe(true)
  })

  it('moves focus with the arrows, Home and End, skipping disabled items', async () => {
    const wrapper = mountMenu()
    const button = wrapper.find('[aria-haspopup="menu"]')
    await button.trigger('keydown', { key: 'ArrowDown' })
    const qr = wrapper.find('[data-testid="qr"]').element
    const pdf = wrapper.find('[data-testid="pdf"]').element
    expect(document.activeElement).toBe(qr)

    key(qr, 'ArrowDown')
    expect(document.activeElement).toBe(pdf)
    key(pdf, 'ArrowDown')
    expect(document.activeElement).toBe(qr)
    key(qr, 'ArrowUp')
    expect(document.activeElement).toBe(pdf)
    key(pdf, 'Home')
    expect(document.activeElement).toBe(qr)
    key(qr, 'End')
    expect(document.activeElement).toBe(pdf)
  })

  it('runs an item and closes, with focus back on its button', async () => {
    const onSelect = vi.fn()
    const wrapper = mountMenu(onSelect)
    await wrapper.find('[aria-haspopup="menu"]').trigger('click')

    await wrapper.find('[data-testid="pdf"]').trigger('click')

    expect(onSelect).toHaveBeenCalledWith('pdf')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('[aria-haspopup="menu"]').element)
  })

  it('does nothing for a disabled item', async () => {
    const wrapper = mountMenu()
    await wrapper.find('[aria-haspopup="menu"]').trigger('click')

    await wrapper.find('[data-testid="png"]').trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
  })

  it('closes on Escape, handing focus back to its button', async () => {
    const wrapper = mountMenu()
    await wrapper.find('[aria-haspopup="menu"]').trigger('keydown', { key: 'Enter' })

    key(document.activeElement!, 'Escape')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('[aria-haspopup="menu"]').element)
  })

  it('closes on a press outside it, and on Tab', async () => {
    const wrapper = mountMenu()
    const button = wrapper.find('[aria-haspopup="menu"]')
    await button.trigger('click')

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await button.trigger('click')
    key(wrapper.find('[data-testid="qr"]').element, 'Tab')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('toggles closed on a second click of its button', async () => {
    const wrapper = mountMenu()
    const button = wrapper.find('[aria-haspopup="menu"]')
    await button.trigger('click')
    await button.trigger('click')

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })
})

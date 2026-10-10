import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import AppMenuItem from './AppMenuItem.vue'
import MenuButton from './MenuButton.vue'
import { menuTooltipBody } from './menuTooltipBody'

const NARROW = '(max-width: 1023px)'

function mountMenu(props: Record<string, unknown> = {}, onSelect = vi.fn(), withSheet = false) {
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          MenuButton,
          { label: 'Export', icon: 'export', ...props },
          {
            default: () => [
              h(AppMenuItem, { 'data-testid': 'qr', onSelect: () => onSelect('qr') }, () => 'PNG image'),
              h(AppMenuItem, { 'data-testid': 'pdf', onSelect: () => onSelect('pdf') }, () => 'PDF'),
            ],
            ...(withSheet ? { sheet: ({ close }: { close: () => void }) => h('div', { 'data-testid': 'sheet', onClick: close }, 'sheet') } : {}),
          },
        )
    },
  })
  return mount(Host, { attachTo: document.body })
}

function key(target: Element, name: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
}

describe('MenuButton', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('opens a menu with the right ARIA state', async () => {
    const wrapper = mountMenu()
    const button = wrapper.find('[aria-haspopup="menu"]')
    expect(button.attributes('aria-expanded')).toBe('false')

    await button.trigger('click')

    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.attributes('aria-controls')).toBe(wrapper.find('[role="menu"]').attributes('id'))
    expect(wrapper.findAll('[role="menuitem"]')).toHaveLength(2)
  })

  it('wraps an IconButton when icon-only, named by its label', async () => {
    const wrapper = mountMenu({ iconOnly: true, icon: 'menu', label: 'Menu' })
    const button = wrapper.find('[aria-haspopup]')
    expect(button.attributes('aria-label')).toBe('Menu')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
  })

  it('announces a popover as a dialog', async () => {
    const wrapper = mountMenu({ popover: true })
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('closes on Escape and hands focus back to the button', async () => {
    const wrapper = mountMenu()
    await wrapper.find('[aria-haspopup]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(wrapper.find('[data-testid="qr"]').element)

    key(document.activeElement!, 'Escape')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('[aria-haspopup]').element)
  })

  it('closes on a press outside, and on choosing an item with focus back on the button', async () => {
    const onSelect = vi.fn()
    const wrapper = mountMenu({}, onSelect)
    const button = wrapper.find('[aria-haspopup]')
    await button.trigger('click')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await button.trigger('click')
    await wrapper.find('[data-testid="pdf"]').trigger('click')
    expect(onSelect).toHaveBeenCalledWith('pdf')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)
  })

  it('does not open while disabled', async () => {
    const wrapper = mountMenu({ disabled: true, disabledBody: 'Nothing to export.' })
    await wrapper.find('[aria-haspopup]').trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('opens the sheet slot under 1024px, and closes it from the sheet', async () => {
    const media = fakeMatchMedia({ [NARROW]: true })
    vi.stubGlobal('matchMedia', media.matchMedia)
    const wrapper = mountMenu({}, vi.fn(), true)
    const button = wrapper.find('[aria-haspopup]')
    expect(button.attributes('aria-haspopup')).toBe('dialog')

    await button.trigger('click')
    expect(wrapper.find('[data-testid="sheet"]').exists()).toBe(true)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await wrapper.find('[data-testid="sheet"]').trigger('click')
    expect(wrapper.find('[data-testid="sheet"]').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)
  })

  it('moves focus with the arrows, Home and End, and closes on Tab', async () => {
    const wrapper = mountMenu()
    await wrapper.find('[aria-haspopup]').trigger('keydown', { key: 'ArrowUp' })
    const qr = wrapper.find('[data-testid="qr"]').element
    const pdf = wrapper.find('[data-testid="pdf"]').element
    expect(document.activeElement).toBe(pdf)
    key(pdf, 'Home')
    expect(document.activeElement).toBe(qr)
    key(qr, 'End')
    expect(document.activeElement).toBe(pdf)
    key(pdf, 'ArrowDown')
    expect(document.activeElement).toBe(qr)

    key(qr, 'Tab')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('reports aria-expanded false again once closed', async () => {
    const wrapper = mountMenu()
    const button = wrapper.find('[aria-haspopup]')
    await button.trigger('click')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.attributes('aria-controls')).toBeUndefined()
  })

  it('shows the footer slot', async () => {
    const wrapper = mount(MenuButton, { props: { label: 'Export' }, slots: { footer: '<p data-testid="footer">x</p>' }, attachTo: document.body })
    await wrapper.find('[aria-haspopup]').trigger('click')
    expect(wrapper.find('[data-testid="footer"]').exists()).toBe(true)
  })

  it('falls back to a popover under 1024px when it has no sheet', async () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ [NARROW]: true }).matchMedia)
    const wrapper = mountMenu()
    await wrapper.find('[aria-haspopup]').trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
  })

  it('keeps a sheet open for a press inside it, even one outside its own element', async () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ [NARROW]: true }).matchMedia)
    const wrapper = mountMenu({}, vi.fn(), true)
    const button = wrapper.find('[aria-haspopup]')
    await button.trigger('click')
    expect(button.attributes('aria-controls')).toBeUndefined()

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="sheet"]').exists()).toBe(true)
  })

  it('closes when the viewport crosses 1024px while open', async () => {
    const media = fakeMatchMedia({ [NARROW]: false })
    vi.stubGlobal('matchMedia', media.matchMedia)
    const wrapper = mountMenu({}, vi.fn(), true)
    const button = wrapper.find('[aria-haspopup]')
    await button.trigger('click')

    media.set(NARROW, true)
    await wrapper.vm.$nextTick()

    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('writes the Tooltip body from the names of what it opens', () => {
    expect(menuTooltipBody(['Set Frame', 'Rotate', 'Copy', 'Paste'])).toBe('Set Frame, Rotate, Copy, Paste.')
  })
})

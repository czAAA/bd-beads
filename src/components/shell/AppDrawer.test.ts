import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDrawer from './AppDrawer.vue'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

const QUERY = '(min-width: 744px) and (max-width: 1023px)'

function mountDrawer(open: boolean, atDrawerTier: boolean) {
  vi.stubGlobal('matchMedia', fakeMatchMedia({ [QUERY]: atDrawerTier }).matchMedia)
  return mount(AppDrawer, {
    attachTo: document.body,
    props: { open, label: 'Tools' },
    slots: { default: '<button type="button">Paint</button><button type="button">Fill</button>' },
  })
}

describe('AppDrawer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is a plain, always-reachable wrapper outside the iPad mini tier, open or not', () => {
    for (const open of [false, true]) {
      const wrapper = mountDrawer(open, false)
      const drawer = wrapper.get('[data-testid="drawer"]')
      expect(drawer.attributes('role')).toBeUndefined()
      expect(drawer.attributes('aria-modal')).toBeUndefined()
      expect(drawer.attributes('inert')).toBeUndefined()
    }
  })

  it('is inert and hidden from the tab order while closed inside the tier, and a real dialog once open', async () => {
    const wrapper = mountDrawer(false, true)
    expect(wrapper.get('[data-testid="drawer"]').attributes('inert')).toBe('true')

    await wrapper.setProps({ open: true })
    const drawer = wrapper.get('[data-testid="drawer"]')
    expect(drawer.attributes('inert')).toBeUndefined()
    expect(drawer.attributes('role')).toBe('dialog')
    expect(drawer.attributes('aria-modal')).toBe('true')
    expect(drawer.attributes('aria-label')).toBe('Tools')
  })

  it('moves focus in on open, traps Tab inside the tier, and gives focus back to the opener on close', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const wrapper = mountDrawer(false, true)
    await wrapper.setProps({ open: true })
    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAll('button')
    expect(document.activeElement).toBe(buttons[0]!.element)

    buttons[1]!.element.focus()
    await wrapper.get('[data-testid="drawer"]').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(buttons[0]!.element)

    await wrapper.get('[data-testid="drawer"]').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(buttons[1]!.element)

    await wrapper.setProps({ open: false })
    expect(document.activeElement).toBe(opener)

    opener.remove()
  })

  it('closes on Escape and on a scrim click, inside the tier', async () => {
    const wrapper = mountDrawer(true, true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.get('[data-testid="drawer-scrim"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('does not react to Escape outside the tier, even if open somehow', () => {
    const wrapper = mountDrawer(true, false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

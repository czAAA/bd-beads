import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BottomSheet from './BottomSheet.vue'

function mountSheet(modal = false) {
  return mount(BottomSheet, {
    attachTo: document.body,
    props: { title: 'Tools', modal },
    slots: { default: '<button type="button">Paint</button><button type="button">Fill</button>' },
  })
}

describe('BottomSheet', () => {
  it('is light by default: no scrim, closes on a press outside it', async () => {
    const wrapper = mountSheet(false)
    expect(wrapper.find('[data-testid="sheet-scrim"]').exists()).toBe(false)

    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    outside.remove()
  })

  it('the modal variant has a scrim, and a press outside it does not close it', async () => {
    const wrapper = mountSheet(true)
    expect(wrapper.find('[data-testid="sheet-scrim"]').exists()).toBe(true)

    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('[data-testid="sheet-scrim"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    outside.remove()
  })

  it('closes on the close button and on Escape', async () => {
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="sheet-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('moves focus in on mount, traps Tab, and gives focus back to the opener on unmount', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const wrapper = mountSheet()
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAll('button').filter((b) => b.text() === 'Paint' || b.text() === 'Fill')
    expect(document.activeElement).toBe(buttons[0]!.element)

    buttons[1]!.element.focus()
    await wrapper.get('[data-testid="bottom-sheet"]').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement?.getAttribute('data-testid')).toBe('sheet-close')

    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})

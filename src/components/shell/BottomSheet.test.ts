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

  it('the modal variant has a scrim and closes on a press outside it too (ticket 402)', async () => {
    const wrapper = mountSheet(true)
    expect(wrapper.find('[data-testid="sheet-scrim"]').exists()).toBe(true)

    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    outside.remove()
  })

  it('a press outside only collapses: neither the press nor its click reaches what is under it (ticket 402)', async () => {
    const wrapper = mountSheet()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const seen: string[] = []
    outside.addEventListener('pointerdown', () => seen.push('pointerdown'))
    outside.addEventListener('click', () => seen.push('click'))

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    wrapper.unmount()
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(seen).toEqual([])

    // The next gesture is untouched.
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(seen).toEqual(['pointerdown', 'click'])
    outside.remove()
  })

  it('a press inside another dialog (a stacked sheet) does not close the one below, and only the top sheet closes on an outside press (ticket 402)', async () => {
    const outer = mountSheet(true)
    const inner = mount(BottomSheet, { attachTo: document.body, props: { title: 'Saved Projects' }, slots: { default: '<button type="button">Open</button>' } })
    await inner.vm.$nextTick()

    inner.get('button').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(outer.emitted('close')).toBeUndefined()
    expect(inner.emitted('close')).toBeUndefined()

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(inner.emitted('close')).toHaveLength(1)
    expect(outer.emitted('close')).toBeUndefined()
    inner.unmount()
    outer.unmount()
  })

  it('the handle closes the sheet on a tap, and on a drag down past the threshold; a short drag springs back (ticket 402)', async () => {
    const wrapper = mountSheet()
    const handle = wrapper.get('[data-testid="sheet-handle"]')
    const fire = (type: string, clientY: number) => handle.element.dispatchEvent(new PointerEvent(type, { bubbles: true, clientY, pointerId: 1 }))

    fire('pointerdown', 100)
    fire('pointerup', 100)
    expect(wrapper.emitted('close')).toHaveLength(1)

    fire('pointerdown', 100)
    fire('pointermove', 130)
    expect((wrapper.get('[data-testid="bottom-sheet"]').element as HTMLElement).style.transform).toBe('translateY(30px)')
    fire('pointerup', 130)
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect((wrapper.get('[data-testid="bottom-sheet"]').element as HTMLElement).style.transform).toBe('')

    fire('pointerdown', 100)
    fire('pointermove', 220)
    fire('pointerup', 220)
    expect(wrapper.emitted('close')).toHaveLength(2)
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

  it('two open sheets stacked (Saved Projects over the Project sheet) do not fight over focus (ticket 385)', async () => {
    const outer = mountSheet(true)
    await outer.vm.$nextTick()

    const inner = mount(BottomSheet, {
      attachTo: document.body,
      props: { title: 'Saved Projects' },
      slots: { default: '<button type="button">Export Project</button>' },
    })
    await inner.vm.$nextTick()

    // The inner sheet's own opening focus stays put: the outer one doesn't pull it back into itself.
    expect(inner.element.contains(document.activeElement)).toBe(true)

    inner.unmount()
    outer.unmount()
  })

  it('skips a data-skip-autofocus control when picking where to land opening focus (ticket 188)', async () => {
    const wrapper = mount(BottomSheet, {
      attachTo: document.body,
      props: { title: 'Size' },
      slots: { default: '<button type="button" data-skip-autofocus>Info</button><button type="button">Columns</button>' },
    })
    await wrapper.vm.$nextTick()

    expect(document.activeElement?.textContent).toBe('Columns')
    // Still reachable normally -- only the sheet's own opening focus skips it.
    expect(wrapper.find('[data-skip-autofocus]').exists()).toBe(true)
  })
})

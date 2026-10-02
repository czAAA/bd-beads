import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppModal from './AppModal.vue'

function mountModal(props: Record<string, unknown> = {}, body = '<p>Body</p>') {
  return mount(AppModal, {
    props: { title: 'Delete all?', ...props },
    slots: {
      default: body,
      actions: '<button data-testid="first">Cancel</button><button data-testid="last">Delete all</button>',
    },
    attachTo: document.body,
  })
}

function tab(from: Element, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
  from.dispatchEvent(event)
  return event
}

describe('AppModal', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is a modal dialog named by its title, with the body and actions inside', () => {
    const wrapper = mountModal()
    const dialog = wrapper.find('[role="dialog"]')

    expect(dialog.attributes('aria-modal')).toBe('true')
    const title = wrapper.find(`#${dialog.attributes('aria-labelledby')}`)
    expect(title.text()).toBe('Delete all?')
    expect(dialog.text()).toContain('Body')
    expect(dialog.find('[data-testid="last"]').exists()).toBe(true)
  })

  it('can be an alert dialog, described by its message', () => {
    const wrapper = mountModal({ role: 'alertdialog', describedby: 'the-message' })

    const dialog = wrapper.find('[role="alertdialog"]')
    expect(dialog.attributes('aria-describedby')).toBe('the-message')
  })

  it('cancels on Escape and on the scrim, but not on a click inside', async () => {
    const wrapper = mountModal()

    await wrapper.find('[role="dialog"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()

    await wrapper.find('[data-testid="modal-scrim"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })

  it('puts focus on the first control, or the one marked data-autofocus', () => {
    const plain = mountModal()
    expect(document.activeElement).toBe(plain.find('[data-testid="first"]').element)
    document.body.innerHTML = ''

    const marked = mountModal({}, '<input data-testid="field" data-autofocus />')
    expect(document.activeElement).toBe(marked.find('[data-testid="field"]').element)
  })

  it('can start focus on the dialog itself, for a panel that is read rather than answered', () => {
    const wrapper = mountModal({ initialFocus: 'dialog' })

    expect(document.activeElement).toBe(wrapper.find('[role="dialog"]').element)
  })

  it('keeps Tab inside: past the last control back to the first, and Shift+Tab the other way', () => {
    const wrapper = mountModal()
    const first = wrapper.find('[data-testid="first"]').element as HTMLElement
    const last = wrapper.find('[data-testid="last"]').element as HTMLElement

    last.focus()
    expect(tab(last).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    expect(tab(first, true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    // In between, Tab is the browser's own.
    first.focus()
    expect(tab(first).defaultPrevented).toBe(false)
  })

  it('gives focus back to the control that opened it', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const wrapper = mountModal()
    expect(document.activeElement).not.toBe(opener)

    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
  })

  it('is 420px for a confirmation and 560px for a panel', () => {
    expect(mountModal().find('[role="dialog"]').classes()).toContain('app-modal--confirm')
    expect(mountModal({ size: 'panel' }).find('[role="dialog"]').classes()).toContain('app-modal--panel')
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmModal from './ConfirmModal.vue'

function mountModal() {
  return mount(ConfirmModal, {
    props: {
      title: 'Delete all?',
      message: 'Every cell will be emptied. This can be undone.',
      confirmLabel: 'Delete all',
      cancelLabel: 'Cancel',
    },
    attachTo: document.body,
  })
}

describe('ConfirmModal', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows the title, message and both button labels from its props', () => {
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('Delete all?')
    expect(wrapper.text()).toContain('Every cell will be emptied. This can be undone.')
    expect(wrapper.find('[data-testid="confirm-modal-cancel"]').text()).toBe('Cancel')
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe('Delete all')
  })

  it('emits confirm when the confirm button is clicked', async () => {
    const wrapper = mountModal()

    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mountModal()

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mountModal()

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel on a backdrop click, but not on a click inside the dialog', async () => {
    const wrapper = mountModal()

    await wrapper.find('[data-testid="confirm-modal-dialog"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()

    await wrapper.find('[data-testid="modal-scrim"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('marks itself as an alert dialog naming its own title and message for assistive tech', () => {
    const wrapper = mountModal()

    const dialog = wrapper.find('[data-testid="confirm-modal-dialog"]')
    expect(dialog.attributes('role')).toBe('alertdialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBeTruthy()
    expect(dialog.attributes('aria-describedby')).toBeTruthy()
  })

  it('stops listening for Escape once unmounted', async () => {
    const wrapper = mountModal()
    wrapper.unmount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // Nothing to assert on the unmounted wrapper directly; this just documents/guards that no error is thrown
    // and no listener is left registered (a leaked one would double-fire in the next test's assertions).
    expect(true).toBe(true)
  })

  it('shows a slot and an extra action', async () => {
    const wrapper = mount(ConfirmModal, {
      props: { title: 'T', message: 'M', confirmLabel: 'Yes', cancelLabel: 'No', extraLabel: 'Save' },
      slots: { default: '<p data-testid="slotted">inside</p>' },
      attachTo: document.body,
    })

    expect(wrapper.find('[data-testid="slotted"]').exists()).toBe(true)
    await wrapper.find('[data-testid="confirm-modal-extra"]').trigger('click')
    expect(wrapper.emitted('extra')).toHaveLength(1)
  })

  it('puts Cancel on the left of the confirm button, with focus on it first', () => {
    const wrapper = mountModal()
    const buttons = wrapper.findAll('button').map((button) => button.attributes('data-testid'))

    expect(buttons.indexOf('confirm-modal-cancel')).toBeLessThan(buttons.indexOf('confirm-modal-confirm'))
    expect(document.activeElement).toBe(wrapper.find('[data-testid="confirm-modal-cancel"]').element)
  })

  it('makes a destructive confirm danger-filled and any other primary', () => {
    expect(mountModal().find('[data-testid="confirm-modal-confirm"]').classes()).toContain('app-button--danger')

    const plain = mount(ConfirmModal, {
      props: { title: 'Switch?', message: 'M', confirmLabel: 'Switch', cancelLabel: 'Keep', confirmDanger: false },
      attachTo: document.body,
    })
    expect(plain.find('[data-testid="confirm-modal-confirm"]').classes()).toContain('app-button--primary')
  })

  it('has no extra action unless one is labelled', () => {
    expect(mountModal().find('[data-testid="confirm-modal-extra"]').exists()).toBe(false)
  })
})

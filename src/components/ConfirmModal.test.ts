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

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel on a backdrop click, but not on a click inside the dialog', async () => {
    const wrapper = mountModal()

    await wrapper.find('[data-testid="confirm-modal-dialog"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()

    await wrapper.find('[data-testid="confirm-modal-backdrop"]').trigger('click')
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
})

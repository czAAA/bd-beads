import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DeleteProjectModal from './DeleteProjectModal.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DeleteProjectModal (ticket 0842)', () => {
  it('names the Project, says to save its Project file first, and offers that beside Cancel and Delete Project', async () => {
    const wrapper = mount(DeleteProjectModal, { props: { name: 'Sunflower' }, attachTo: document.body })
    const button = (id: string) => wrapper.get(`[data-testid="confirm-modal-${id}"]`)

    expect(wrapper.text()).toContain('Delete “Sunflower”?')
    expect(wrapper.get('[data-testid="confirm-modal-message"]').text()).toBe(
      "“Sunflower” and its Row progress are removed from this device. This can't be undone. Save its Project file first if you want to keep it.",
    )
    expect(['extra', 'cancel', 'confirm'].map((id) => button(id).text())).toEqual(['Save Project file', 'Cancel', 'Delete Project'])

    await button('extra').trigger('click')
    await button('confirm').trigger('click')
    await button('cancel').trigger('click')
    expect([wrapper.emitted('saveFile'), wrapper.emitted('confirm'), wrapper.emitted('cancel')].map((each) => each?.length)).toEqual([1, 1, 1])
  })
})

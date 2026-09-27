import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextBar from './ContextBar.vue'

describe('ContextBar', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('is absent with neither a Selection nor an armed paste', () => {
    const wrapper = mount(ContextBar, { props: { pasteArmed: false, canRemoveLine: false } })
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('shows the Selection\'s size, Copy, Rotate, Remove line and a clear x while it exists', async () => {
    const wrapper = mount(ContextBar, {
      props: { selectionSize: { columns: 3, rows: 5 }, pasteArmed: false, canRemoveLine: true },
    })

    expect(wrapper.get('[data-testid="context-bar-size"]').text()).toBe('3×5')
    expect(wrapper.get('[data-testid="context-bar-copy"]').text()).toContain('Copy')
    expect(wrapper.get('[data-testid="context-bar-rotate"]').text()).toContain('Rotate')
    expect(wrapper.get('[data-testid="context-bar-remove-line"]').text()).toContain('Remove line')
    expect(wrapper.get('[data-testid="context-bar-remove-line"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="context-bar-copy"]').trigger('click')
    expect(wrapper.emitted('copy')).toHaveLength(1)
    await wrapper.get('[data-testid="context-bar-rotate"]').trigger('click')
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    await wrapper.get('[data-testid="context-bar-remove-line"]').trigger('click')
    expect(wrapper.emitted('remove-line')).toHaveLength(1)
    await wrapper.get('[data-testid="context-bar-clear"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('disables Remove line when the Selection is not a whole row or column', () => {
    const wrapper = mount(ContextBar, {
      props: { selectionSize: { columns: 3, rows: 5 }, pasteArmed: false, canRemoveLine: false },
    })
    expect(wrapper.get('[data-testid="context-bar-remove-line"]').attributes('disabled')).toBeDefined()
  })

  it('turns into "Tap where to paste", Rotate and Cancel once armed', async () => {
    const wrapper = mount(ContextBar, { props: { pasteArmed: true, canRemoveLine: false } })

    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="context-bar-hint"]').text()).toBe('Tap where to paste')
    expect(wrapper.get('[data-testid="context-bar-rotate"]').text()).toContain('Rotate')
    expect(wrapper.get('[data-testid="context-bar-cancel"]').text()).toBe('Cancel')

    await wrapper.get('[data-testid="context-bar-cancel"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})

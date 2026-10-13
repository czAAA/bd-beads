import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EditControls from './EditControls.vue'
import { controlDeps } from '../../composables/shell/controlRegistry'

/** Every registry action EditControls can show reads `deps` even to say it's enabled, so every mount needs one. */
function enabledDeps() {
  return controlDeps({ activeProject: () => undefined, canUndo: () => true, canRedo: () => true, hasSelection: () => true, hasClipboard: () => true })
}

describe('EditControls (pulled out of Toolbox.vue for ticket 384, shared with the phone Frame sheet)', () => {
  it("renders exactly the ids it's given, each under the caller's own testid", () => {
    const wrapper = mount(EditControls, {
      props: { ids: ['undo', 'redo', 'rotate', 'copy'], testIdFor: (id) => `${id}-button`, deps: enabledDeps() },
    })
    const testIds = wrapper.findAll('button').map((button) => button.attributes('data-testid'))
    expect(testIds).toEqual(['undo-button', 'redo-button', 'rotate-button', 'copy-button'])
  })

  it('leaves the testid off a button when testIdFor returns undefined, as the phone sheet does for Copy', () => {
    const wrapper = mount(EditControls, {
      props: { ids: ['rotate', 'copy'], testIdFor: (id) => (id === 'copy' ? undefined : `sheet-${id}`), deps: enabledDeps() },
    })
    expect(wrapper.get('[data-testid="sheet-rotate"]')).toBeTruthy()
    expect(wrapper.find('[data-testid="sheet-copy"]').exists()).toBe(false)
  })

  it('emits activate with the clicked id', async () => {
    const wrapper = mount(EditControls, {
      props: { ids: ['rotate', 'copy', 'paste'], testIdFor: (id) => `sheet-${id}`, deps: enabledDeps() },
    })
    await wrapper.get('[data-testid="sheet-paste"]').trigger('click')
    expect(wrapper.emitted('activate')).toEqual([['paste']])
  })

  it('disables a button purely from its own deps, not internal state', () => {
    const deps = controlDeps({ activeProject: () => undefined, canUndo: () => false, hasSelection: () => false })
    const wrapper = mount(EditControls, {
      props: { ids: ['undo', 'copy'], testIdFor: (id) => `${id}-button`, deps },
    })
    expect(wrapper.get<HTMLButtonElement>('[data-testid="undo-button"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get<HTMLButtonElement>('[data-testid="copy-button"]').attributes('aria-disabled')).toBe('true')
  })

  it('carries the product tour step ids on Undo and Copy, and none on Redo or Paste (ticket 80, switched off)', () => {
    const wrapper = mount(EditControls, {
      props: { ids: ['undo', 'redo', 'copy', 'paste'], testIdFor: (id) => `${id}-button`, deps: enabledDeps() },
    })
    expect(wrapper.get('[data-testid="undo-button"]').attributes('data-tour')).toBe('undo')
    expect(wrapper.get('[data-testid="copy-button"]').attributes('data-tour')).toBe('copy')
    expect(wrapper.get('[data-testid="redo-button"]').attributes('data-tour')).toBeUndefined()
    expect(wrapper.get('[data-testid="paste-button"]').attributes('data-tour')).toBeUndefined()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useSaveOnPageHide } from './useSaveOnPageHide'

function mountWith() {
  const flushPendingSave = vi.fn()
  const wrapper = mount(
    defineComponent({
      setup() {
        useSaveOnPageHide(flushPendingSave)
        return () => h('div')
      },
    }),
  )
  return { flushPendingSave, wrapper }
}

describe('useSaveOnPageHide', () => {
  it('flushes a deferred save when the page is hidden', () => {
    const { flushPendingSave } = mountWith()
    window.dispatchEvent(new Event('pagehide'))
    expect(flushPendingSave).toHaveBeenCalledTimes(1)
  })

  it('flushes on unmount and stops listening for pagehide', () => {
    const { flushPendingSave, wrapper } = mountWith()
    wrapper.unmount()
    expect(flushPendingSave).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('pagehide'))
    expect(flushPendingSave).toHaveBeenCalledTimes(1)
  })
})

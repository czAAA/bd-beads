import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useSaveOnPageHide } from './useSaveOnPageHide'

function mountWith() {
  const calls: string[] = []
  const flushPendingSave = vi.fn(() => void calls.push('flush'))
  const noteClosing = vi.fn(() => void calls.push('note'))
  const wrapper = mount(
    defineComponent({
      setup() {
        useSaveOnPageHide(flushPendingSave, noteClosing)
        return () => h('div')
      },
    }),
  )
  return { flushPendingSave, noteClosing, calls, wrapper }
}

describe('useSaveOnPageHide', () => {
  it('flushes a deferred save when the page is hidden', () => {
    const { flushPendingSave } = mountWith()
    window.dispatchEvent(new Event('pagehide'))
    expect(flushPendingSave).toHaveBeenCalledTimes(1)
  })

  it('notes the writes under way for the next start after the flush has started its own, on pagehide only', () => {
    const { noteClosing, calls, wrapper } = mountWith()
    window.dispatchEvent(new Event('pagehide'))
    expect(calls).toEqual(['flush', 'note'])
    wrapper.unmount()
    expect(noteClosing).toHaveBeenCalledTimes(1)
  })

  it('flushes on unmount and stops listening for pagehide', () => {
    const { flushPendingSave, wrapper } = mountWith()
    wrapper.unmount()
    expect(flushPendingSave).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('pagehide'))
    expect(flushPendingSave).toHaveBeenCalledTimes(1)
  })
})

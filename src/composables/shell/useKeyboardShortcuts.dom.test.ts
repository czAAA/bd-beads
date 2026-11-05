import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts'
import { provideShellScope } from '../ui/shellScope'

/** A minimal host component: useKeyboardShortcuts is a composable, so it needs a live component instance
 *  (lifecycle hooks) to run inside, same as it will in App.vue. */
function mountHost(shortcuts: KeyboardShortcut[]) {
  return mount(
    defineComponent({
      setup() {
        useKeyboardShortcuts(shortcuts)
      },
      render() {
        return h('div')
      },
    }),
  )
}

function press(init: KeyboardEventInit, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
}

describe('useKeyboardShortcuts', () => {
  it('fires the first entry whose matches passes, and no other', () => {
    const first = vi.fn()
    const second = vi.fn()
    mountHost([
      { matches: (e) => e.key === 'a', action: first },
      { matches: (e) => e.key === 'a', action: second },
    ])

    press({ key: 'a' })

    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('skips an entry whose guard fails, falling through to the next match', () => {
    const guarded = vi.fn()
    const fallback = vi.fn()
    mountHost([
      { matches: (e) => e.key === 'a', guard: () => false, action: guarded },
      { matches: (e) => e.key === 'a', action: fallback },
    ])

    press({ key: 'a' })

    expect(guarded).not.toHaveBeenCalled()
    expect(fallback).toHaveBeenCalledOnce()
  })

  it('suppresses a shortcut while typing in a form field by default', () => {
    const action = vi.fn()
    mountHost([{ matches: (e) => e.key === 'a', action }])
    const field = document.createElement('input')
    document.body.appendChild(field)

    try {
      press({ key: 'a' }, field)
      expect(action).not.toHaveBeenCalled()
    } finally {
      field.remove()
    }
  })

  it('still fires a shortcut marked allowWhileTyping', () => {
    const action = vi.fn()
    mountHost([{ matches: (e) => e.key === 'Escape', allowWhileTyping: true, action }])
    const field = document.createElement('input')
    document.body.appendChild(field)

    try {
      press({ key: 'Escape' }, field)
      expect(action).toHaveBeenCalledOnce()
    } finally {
      field.remove()
    }
  })

  it('stops listening once the host unmounts', () => {
    const action = vi.fn()
    const wrapper = mountHost([{ matches: (e) => e.key === 'a', action }])
    wrapper.unmount()

    press({ key: 'a' })

    expect(action).not.toHaveBeenCalled()
  })
})

describe('useKeyboardShortcuts in a boxed shell (ticket 0797)', () => {
  it('takes only the keys pressed while the focus is in its box', () => {
    const box = document.body.appendChild(document.createElement('div'))
    const inside = box.appendChild(document.createElement('button'))
    const outside = document.body.appendChild(document.createElement('button'))
    const action = vi.fn()
    const child = defineComponent({
      setup() {
        useKeyboardShortcuts([{ matches: (e) => e.key === 'z', action }])
        return () => h('div')
      },
    })
    const host = mount(
      defineComponent({
        setup() {
          provideShellScope({ root: () => box, teleportTo: 'body' })
          return () => h(child)
        },
      }),
    )

    press({ key: 'z' }, outside)
    press({ key: 'z' }, document.body)
    expect(action).not.toHaveBeenCalled()
    press({ key: 'z' }, inside)
    expect(action).toHaveBeenCalledOnce()

    host.unmount()
    box.remove()
    outside.remove()
  })
})

import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import type { AppUpdates } from '../../services/offlineShell'
import { useUpdatePrompt } from './useUpdatePrompt'

/** A fake offline shell: `release()` is the moment a newer version finishes downloading behind the open page. */
function fakeUpdates(readyAlready = false) {
  const listeners = new Set<() => void>()
  const updates: AppUpdates = {
    onReady(listener) {
      listeners.add(listener)
      if (readyAlready) listener()
      return () => void listeners.delete(listener)
    },
    apply: vi.fn(),
  }
  return { updates, release: () => listeners.forEach((listener) => listener()), listening: () => listeners.size }
}

describe('useUpdatePrompt', () => {
  it('stays quiet until a newer version is waiting', () => {
    const { updates } = fakeUpdates()
    const showToast = vi.fn()
    effectScope().run(() => useUpdatePrompt({ updates, messages: () => en, showToast }))
    expect(showToast).not.toHaveBeenCalled()
  })

  it('then offers Reload in a toast that stays, and Reload switches to the new version', () => {
    const { updates, release } = fakeUpdates()
    const showToast = vi.fn()
    effectScope().run(() => useUpdatePrompt({ updates, messages: () => en, showToast }))
    release()
    expect(showToast).toHaveBeenCalledWith('update-ready', en.shell.updateReady, 'info', expect.objectContaining({ label: en.shell.updateReload }), true)
    showToast.mock.calls[0][3].run()
    expect(updates.apply).toHaveBeenCalledOnce()
  })

  it('offers it at once when the version was waiting before the app started', () => {
    const { updates } = fakeUpdates(true)
    const showToast = vi.fn()
    effectScope().run(() => useUpdatePrompt({ updates, messages: () => en, showToast }))
    expect(showToast).toHaveBeenCalledOnce()
  })

  it('speaks the language chosen when it appears', () => {
    const { updates, release } = fakeUpdates()
    const showToast = vi.fn()
    let language = en
    effectScope().run(() => useUpdatePrompt({ updates, messages: () => language, showToast }))
    language = ru
    release()
    expect(showToast.mock.calls[0][1]).toBe(ru.shell.updateReady)
  })

  it('stops listening when the app is torn down', () => {
    const { updates, listening } = fakeUpdates()
    const scope = effectScope()
    scope.run(() => useUpdatePrompt({ updates, messages: () => en, showToast: vi.fn() }))
    expect(listening()).toBe(1)
    scope.stop()
    expect(listening()).toBe(0)
  })
})

import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import type { AppSignIn } from '../../services/offlineShell'
import { useSignInPrompt } from './useSignInPrompt'

/** A fake host sign-in: `runOut()` is the moment the app notices the host asks to sign in again. */
function fakeSignIn() {
  const listeners = new Set<() => void>()
  const signIn: AppSignIn = {
    onRunOut(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    signIn: vi.fn(),
  }
  return { signIn, runOut: () => listeners.forEach((listener) => listener()), listening: () => listeners.size }
}

describe('useSignInPrompt', () => {
  it('stays quiet while the sign-in holds', () => {
    const { signIn } = fakeSignIn()
    const showToast = vi.fn()
    effectScope().run(() => useSignInPrompt({ signIn, messages: () => en, showToast }))
    expect(showToast).not.toHaveBeenCalled()
  })

  it('offers Sign in in a toast that stays once it has run out, and Sign in goes to the host', () => {
    const { signIn, runOut } = fakeSignIn()
    const showToast = vi.fn()
    effectScope().run(() => useSignInPrompt({ signIn, messages: () => en, showToast }))
    runOut()
    expect(showToast).toHaveBeenCalledWith('sign-in', en.shell.signInRunOut, 'info', expect.objectContaining({ label: en.shell.signIn }), { persistent: true })
    showToast.mock.calls[0][3].run()
    expect(signIn.signIn).toHaveBeenCalledOnce()
  })

  it('speaks the language chosen when it appears', () => {
    const { signIn, runOut } = fakeSignIn()
    const showToast = vi.fn()
    let language = en
    effectScope().run(() => useSignInPrompt({ signIn, messages: () => language, showToast }))
    language = ru
    runOut()
    expect(showToast.mock.calls[0][1]).toBe(ru.shell.signInRunOut)
  })

  it('stops listening when the app is torn down', () => {
    const { signIn, listening } = fakeSignIn()
    const scope = effectScope()
    scope.run(() => useSignInPrompt({ signIn, messages: () => en, showToast: vi.fn() }))
    expect(listening()).toBe(1)
    scope.stop()
    expect(listening()).toBe(0)
  })
})

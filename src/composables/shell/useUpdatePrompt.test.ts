import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { Locale } from '../../domain/locale'
import type { WhatWaits } from '../../domain/waitingBuild'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import type { AppUpdates } from '../../services/offlineShell'
import { useUpdatePrompt } from './useUpdatePrompt'

const ONE_NEW: WhatWaits = { version: '2.2.0', notes: [{ name: '2026-12-02-0001', version: '2.2.0', date: '2026-12-02', kind: 'new', line: 'A new thing' }] }

/** A fake offline shell: `release(waits)` is the moment a newer version, bringing `waits`, is waiting behind the page. */
function fakeUpdates(readyAlready?: WhatWaits) {
  const listeners = new Set<(waits: WhatWaits) => void>()
  const asked: Locale[] = []
  const updates: AppUpdates = {
    onReady(locale, listener) {
      listeners.add(listener)
      asked.push(locale())
      if (readyAlready) listener(readyAlready)
      return () => void listeners.delete(listener)
    },
    apply: vi.fn(),
  }
  return { updates, asked, release: (waits: WhatWaits) => listeners.forEach((listener) => listener(waits)), listening: () => listeners.size }
}

function prompt(updates: AppUpdates, messages = () => en) {
  const showToast = vi.fn()
  effectScope().run(() => useUpdatePrompt({ updates, messages, locale: () => 'ru', showToast }))
  return showToast
}

describe('useUpdatePrompt', () => {
  it('stays quiet until a newer version is waiting', () => {
    const { updates } = fakeUpdates()
    expect(prompt(updates)).not.toHaveBeenCalled()
  })

  it('then names what waits in a toast that stays, with Reload, which switches, and What\'s new, the Homepage\'s (ticket 1048)', () => {
    const { updates, release } = fakeUpdates()
    const showToast = prompt(updates)
    release(ONE_NEW)
    expect(showToast).toHaveBeenCalledWith('update-ready', en.shell.updateReady, 'info', expect.objectContaining({ label: en.shell.updateReload }), {
      persistent: true,
      secondAction: expect.objectContaining({ label: en.homepage.whatsNew.name, href: `${import.meta.env.BASE_URL}#whats-new` }),
      update: { version: '2.2.0', note: { kind: 'new', line: 'A new thing' } },
    })
    showToast.mock.calls[0][3].run()
    expect(updates.apply).toHaveBeenCalledOnce()
  })

  it('says only "Update ready", with both actions, when what waits is unknown', () => {
    const { updates, release } = fakeUpdates()
    const showToast = prompt(updates)
    release('unknown')
    const [, text, , action, options] = showToast.mock.calls[0]
    expect([text, action.label, options.secondAction.label, options.update]).toEqual([en.shell.updateReady, en.shell.updateReload, en.homepage.whatsNew.name, {}])
  })

  it('shows the newer answer in place of the first when a newer Build takes the waiting one\'s place', () => {
    const { updates, release } = fakeUpdates()
    const showToast = prompt(updates)
    release(ONE_NEW)
    release({ version: '2.3.0', notes: [] })
    expect(showToast).toHaveBeenCalledTimes(2)
    expect(showToast.mock.calls[1][0]).toBe('update-ready')
    expect(showToast.mock.calls[1][4].update).toEqual({ version: '2.3.0' })
  })

  it('offers it at once when the version was waiting before the app started, asking in the language shown', () => {
    const { updates, asked } = fakeUpdates(ONE_NEW)
    expect(prompt(updates)).toHaveBeenCalledOnce()
    expect(asked).toEqual(['ru'])
  })

  it('speaks the language chosen when it appears', () => {
    const { updates, release } = fakeUpdates()
    let language = en
    const showToast = prompt(updates, () => language)
    language = ru
    release(ONE_NEW)
    expect(showToast.mock.calls[0][1]).toBe(ru.shell.updateReady)
  })

  it('stops listening when the app is torn down', () => {
    const { updates, listening } = fakeUpdates()
    const scope = effectScope()
    scope.run(() => useUpdatePrompt({ updates, messages: () => en, locale: () => 'en', showToast: vi.fn() }))
    expect(listening()).toBe(1)
    scope.stop()
    expect(listening()).toBe(0)
  })
})

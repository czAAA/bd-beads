import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeviceSettings, KeptSettings } from '../../domain/keptSettings'
import { en } from '../../i18n/en'
import { memoryAccount, type MemoryAccountState } from '../../services/memoryAccount'
import { memoryDeviceSettings } from '../../testUtils/deviceSettings'
import { useAccountFlow } from './useAccountFlow'

// The Settings kept in step (ticket 1086), driven through the account flow that owns them: a device and a backend in
// memory, and a clock the test moves.

const ann = { email: 'ann@example.com', plan: 'free' } as const
const NOW = Date.parse('2026-11-19T10:00:00Z')

function setup(start: Partial<MemoryAccountState> = {}, shows: Partial<DeviceSettings> = {}) {
  const account = memoryAccount(start)
  const device = memoryDeviceSettings(shows)
  const showToast = vi.fn()
  const scope = effectScope()
  const flow = scope.run(() =>
    useAccountFlow({ account, messages: () => en, showToast, openMenu: vi.fn(), foldedSections: ref<readonly string[]>([]), settings: device.controls }),
  )!
  return { account, device, showToast, flow, scope }
}

/** A device already signed in, whose account holds what the device shows, but for `held`. */
function signedIn(start: Partial<MemoryAccountState> = {}, shows: Partial<DeviceSettings> = {}, held: KeptSettings = {}) {
  const shown = { language: 'en', theme: 'device', ...shows } as DeviceSettings
  const settings: KeptSettings = {
    language: { value: shown.language, changedAt: NOW - 5000 },
    theme: { value: shown.theme, changedAt: NOW - 5000 },
    ...held,
  }
  return setup({ remembered: ann, session: ann, settings, ...start }, shows)
}

/** Lets the flow's awaited answers land. */
const settled = () => new Promise((resolve) => setTimeout(resolve))
const later = (ms: number) => vi.setSystemTime(Date.now() + ms)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('the Settings kept in step: signing in', () => {
  it('lets the account win at sign-in, through the device’s own setters, with no toast', async () => {
    const settings = { language: { value: 'ru', changedAt: 1 }, theme: { value: 'dark', changedAt: 2 } } as const
    const { account, device, showToast } = setup({ returned: 'signed-in', session: ann, settings }, { language: 'en', theme: 'light' })
    await settled()
    expect(device.shown).toEqual({ language: 'ru', theme: 'dark' })
    expect(device.sets).toEqual([{ language: 'ru' }, { theme: 'dark' }])
    // Taking the account's values is not a change made here: nothing is sent back.
    expect(account.state.sent).toEqual([])
    expect(account.state.settings).toEqual(settings)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('uploads the device’s two at the first sign-in ever', async () => {
    const { account, device } = setup({ returned: 'signed-in', session: ann }, { language: 'pl', theme: 'contrast' })
    await settled()
    const uploaded = { language: { value: 'pl', changedAt: NOW }, theme: { value: 'contrast', changedAt: NOW } }
    expect(account.state.sent).toEqual([uploaded])
    expect(account.state.settings).toEqual(uploaded)
    expect(device.sets).toEqual([])
  })

  it('takes what the account holds and sends only what it lacks', async () => {
    const { account, device } = setup({ returned: 'signed-in', session: ann, settings: { theme: { value: 'dark', changedAt: 2 } } }, { language: 'es' })
    await settled()
    expect(device.shown).toEqual({ language: 'es', theme: 'dark' })
    expect(account.state.sent).toEqual([{ language: { value: 'es', changedAt: NOW } }])
  })

  it('keeps the device’s own where the account holds a value from a newer build, and sends nothing over it', async () => {
    const settings = { language: 'unknown', theme: { value: 'dark', changedAt: 2 } } as const
    const { account, device } = setup({ returned: 'signed-in', session: ann, settings }, { language: 'uk' })
    await settled()
    expect(device.shown).toEqual({ language: 'uk', theme: 'dark' })
    expect(account.state.sent).toEqual([])
    expect(account.state.settings).toEqual(settings)
  })

  it('leaves a Guest’s device alone: a change is kept nowhere but on the device, and nothing is sent', async () => {
    const { account, device } = setup()
    device.shown.theme = 'dark'
    account.comeBackInView()
    account.comeOnline()
    await settled()
    expect(account.state.waiting).toEqual({})
    expect(account.state.sent).toEqual([])
  })

  it('takes and uploads nothing while the settings are switched off', async () => {
    const { account, device } = setup({ returned: 'signed-in', session: ann, settings: 'off' }, { theme: 'dark' })
    await settled()
    expect(device.sets).toEqual([])
    expect(account.state.sent).toEqual([])
  })
})

describe('the Settings kept in step: a change on a signed-in device', () => {
  it('is sent at once, with the time it was made', async () => {
    const { account, device } = signedIn()
    await settled()
    later(1000)
    device.shown.theme = 'dark'
    await settled()
    expect(account.state.sent).toEqual([{ theme: { value: 'dark', changedAt: NOW + 1000 } }])
    expect(account.state.waiting).toEqual({})
    expect(account.state.settings).toMatchObject({ theme: { value: 'dark', changedAt: NOW + 1000 } })
  })

  it('waits quietly when it can’t be sent, and goes with the next change', async () => {
    const { account, device, showToast } = signedIn()
    await settled()
    account.state.backend = { ok: false, reason: 'offline' }
    later(1000)
    device.shown.language = 'ru'
    await settled()
    expect(account.state.waiting).toEqual({ language: { value: 'ru', changedAt: NOW + 1000 } })
    expect(showToast).not.toHaveBeenCalled()
    account.state.backend = 'up'
    later(1000)
    device.shown.theme = 'dark'
    await settled()
    expect(account.state.sent).toEqual([{ language: { value: 'ru', changedAt: NOW + 1000 }, theme: { value: 'dark', changedAt: NOW + 2000 } }])
    expect(account.state.waiting).toEqual({})
  })

  it('is sent when the tab comes back into view, or when the device is online again', async () => {
    for (const comeBack of ['comeBackInView', 'comeOnline'] as const) {
      const { account, device } = signedIn()
      await settled()
      account.state.backend = { ok: false, reason: 'offline' }
      device.shown.theme = 'light'
      await settled()
      expect(account.state.sent, comeBack).toEqual([])
      account.state.backend = 'up'
      account[comeBack]()
      await settled()
      expect(account.state.sent, comeBack).toEqual([{ theme: { value: 'light', changedAt: NOW } }])
      expect(device.shown.theme, comeBack).toBe('light')
    }
  })

  it('is sent as the tab comes back also when the account itself gives no answer then', async () => {
    const { account, device } = signedIn()
    await settled()
    account.state.backend = { ok: false, reason: 'offline' }
    device.shown.theme = 'light'
    await settled()
    account.state.backend = 'up'
    account.check = async () => ({ state: 'no-answer' })
    account.comeBackInView()
    await settled()
    expect(account.state.sent).toEqual([{ theme: { value: 'light', changedAt: NOW } }])
  })

  it('made offline wins over an earlier change on another device, once it is sent', async () => {
    const { account, device } = signedIn()
    await settled()
    account.state.backend = { ok: false, reason: 'offline' }
    later(60_000)
    device.shown.theme = 'dark'
    await settled()
    // Another device changed the theme before that, and the account already holds it.
    account.state.settings = { ...(account.state.settings as object), theme: { value: 'contrast', changedAt: NOW + 30_000 } }
    later(60_000)
    account.state.backend = 'up'
    account.comeOnline()
    await settled()
    expect(account.state.settings).toMatchObject({ theme: { value: 'dark', changedAt: NOW + 60_000 } })
    expect(device.shown.theme).toBe('dark')
  })

  it('made offline loses to a later change on another device, and the device takes that one', async () => {
    const { account, device } = signedIn()
    await settled()
    account.state.backend = { ok: false, reason: 'offline' }
    later(60_000)
    device.shown.theme = 'dark'
    later(60_000)
    account.state.settings = { ...(account.state.settings as object), theme: { value: 'contrast', changedAt: NOW + 90_000 } }
    account.state.backend = 'up'
    account.comeBackInView()
    await settled()
    expect(account.state.settings).toMatchObject({ theme: { value: 'contrast', changedAt: NOW + 90_000 } })
    expect(device.shown.theme).toBe('contrast')
    expect(account.state.waiting).toEqual({})
    // The value taken from the account is not sent back as a change of this device's.
    expect(account.state.sent).toHaveLength(1)
  })

  it('sends a setting changed again while the first change was on its way', async () => {
    const { account, device } = signedIn()
    await settled()
    device.shown.theme = 'dark'
    later(10)
    device.shown.theme = 'light'
    await settled()
    expect(account.state.sent).toEqual([{ theme: { value: 'dark', changedAt: NOW } }, { theme: { value: 'light', changedAt: NOW + 10 } }])
    expect(account.state.settings).toMatchObject({ theme: { value: 'light', changedAt: NOW + 10 } })
    expect(device.shown.theme).toBe('light')
  })
})

describe('the Settings kept in step: the app opens, or its tab comes back', () => {
  it('takes the account’s settings as the app opens and as its tab comes back into view', async () => {
    const { account, device } = signedIn({}, { language: 'en' }, { language: { value: 'be', changedAt: NOW - 1000 } })
    await settled()
    expect(device.shown.language).toBe('be')
    account.state.settings = { ...(account.state.settings as object), theme: { value: 'dark', changedAt: NOW + 1000 } }
    account.comeBackInView()
    await settled()
    expect(device.shown.theme).toBe('dark')
    expect(account.state.sent).toEqual([])
  })

  it('does not put the account’s older value over a setting changed here and not yet sent', async () => {
    const waiting = { theme: { value: 'dark', changedAt: NOW - 1000 } } as const
    const { account, device } = signedIn({ waiting }, { theme: 'dark' }, { theme: { value: 'light', changedAt: NOW - 2000 } })
    await settled()
    expect(device.shown.theme).toBe('dark')
    expect(account.state.settings).toMatchObject({ theme: { value: 'dark', changedAt: NOW - 1000 } })
  })

  it('does not send back a value of the account’s that reaches the device late, as a language still loading does', async () => {
    const account = memoryAccount({ remembered: ann, session: ann, settings: { language: { value: 'zh', changedAt: NOW - 1000 } } })
    const device = memoryDeviceSettings()
    let arrive = () => {}
    device.controls.language.set = (language) => void (arrive = () => (device.shown.language = language))
    effectScope().run(() => useAccountFlow({ account, messages: () => en, showToast: vi.fn(), openMenu: vi.fn(), foldedSections: ref<readonly string[]>([]), settings: device.controls }))
    await settled()
    account.state.sent.length = 0
    expect(device.shown.language).toBe('en')
    arrive()
    await settled()
    expect(device.shown.language).toBe('zh')
    expect(account.state.sent).toEqual([])
    // The next change of it is the person's own again.
    device.shown.language = 'pl'
    await settled()
    expect(account.state.sent).toEqual([{ language: { value: 'pl', changedAt: NOW } }])
  })

  it('leaves alone an answer that may be older than a change sent while it was on its way', async () => {
    const { account, device } = signedIn()
    await settled()
    const asked = account.check
    let answer = () => {}
    account.check = async () => {
      const early = await asked()
      await new Promise<void>((resolve) => (answer = resolve))
      return early
    }
    account.comeBackInView()
    await settled()
    device.shown.theme = 'dark'
    await settled()
    answer()
    await settled()
    expect(device.shown.theme).toBe('dark')
    expect(account.state.sent).toHaveLength(1)
  })
})

describe('the Settings kept in step: signing out', () => {
  it('drops what was waiting to be sent, so it reaches no account that signs in here later', async () => {
    const { account, device, flow } = signedIn()
    await settled()
    account.state.backend = { ok: false, reason: 'offline' }
    device.shown.theme = 'dark'
    await settled()
    expect(account.state.waiting).not.toEqual({})
    await flow.onSignOut()
    expect(account.state.waiting).toEqual({})
    expect(device.shown.theme).toBe('dark')
    account.state.backend = 'up'
    device.shown.language = 'ru'
    account.comeOnline()
    await settled()
    expect(account.state.sent).toEqual([])
  })

  it('is a Guest’s device again when sending finds the session ended, and its settings stay as they are', async () => {
    const { account, device, flow, showToast } = signedIn()
    await settled()
    account.state.session = undefined
    device.shown.theme = 'dark'
    await settled()
    expect(flow.account.value).toBeUndefined()
    expect(account.state.waiting).toEqual({})
    expect(device.shown.theme).toBe('dark')
    expect(showToast).not.toHaveBeenCalled()
  })

  it('stops sending once its scope is gone', async () => {
    const { account, device, scope } = signedIn()
    await settled()
    scope.stop()
    device.shown.theme = 'dark'
    account.comeOnline()
    await settled()
    expect(account.state.sent).toEqual([])
  })
})

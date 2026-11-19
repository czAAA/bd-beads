import { describe, expect, it } from 'vitest'
import { changedSince, parseAccountSettings, parseSettingsChanges, settingsStep, type DeviceSettings } from './keptSettings'

const device: DeviceSettings = { language: 'en', theme: 'device', liftedPieces: 'on' }

describe('parseSettingsChanges: what the Worker takes', () => {
  it('takes any of the three settings with their own values and a time', () => {
    const settings = { language: { value: 'zh', changedAt: 5 }, theme: { value: 'device', changedAt: 6 }, liftedPieces: { value: 'off', changedAt: 7 } }
    expect(parseSettingsChanges({ settings })).toEqual(settings)
    expect(parseSettingsChanges({ settings: { theme: { value: 'contrast', changedAt: 0 } } })).toEqual({ theme: { value: 'contrast', changedAt: 0 } })
    expect(parseSettingsChanges({ settings: {} })).toEqual({})
  })

  it('refuses another shape, another setting, a value that is not the setting’s own, or a time that is not one', () => {
    const at = { changedAt: 5 }
    for (const body of [
      undefined,
      null,
      'theme',
      [],
      {},
      { settings: null },
      { settings: [] },
      { settings: { makerName: { value: 'Ann', ...at } } },
      { settings: { constructor: { value: 'dark', ...at } } },
      { settings: { theme: { value: 'dark', ...at }, language: { value: 'de', ...at } } },
      { settings: { theme: { value: 'on', ...at } } },
      { settings: { liftedPieces: { value: true, ...at } } },
      { settings: { theme: 'dark' } },
      { settings: { theme: { value: 'dark' } } },
      { settings: { theme: { value: 'dark', changedAt: '5' } } },
      { settings: { theme: { value: 'dark', changedAt: 5.5 } } },
      { settings: { theme: { value: 'dark', changedAt: -5 } } },
      { settings: { theme: { value: 'dark', changedAt: Number.POSITIVE_INFINITY } } },
    ]) {
      expect(parseSettingsChanges(body), JSON.stringify(body)).toBeUndefined()
    }
  })
})

describe('parseAccountSettings: what a device reads', () => {
  it('reads the settings the account holds, and none from an answer that holds none', () => {
    expect(parseAccountSettings({ language: { value: 'pl', changedAt: 5 } })).toEqual({ language: { value: 'pl', changedAt: 5 } })
    expect(parseAccountSettings({})).toEqual({})
    for (const none of [undefined, null, 'settings', []]) expect(parseAccountSettings(none)).toBeUndefined()
  })

  it('reads a value this build doesn’t know as unknown, and leaves out a setting it doesn’t know', () => {
    const sent = { language: { value: 'de', changedAt: 5 }, theme: { value: 'dark', changedAt: 6 }, canvasColor: { value: '2', changedAt: 7 } }
    expect(parseAccountSettings(sent)).toEqual({ language: 'unknown', theme: { value: 'dark', changedAt: 6 } })
  })
})

describe('settingsStep: what a device does with its account’s settings', () => {
  it('takes the account’s values where they differ from the device’s', () => {
    const account = { language: { value: 'ru', changedAt: 1 }, theme: { value: 'device', changedAt: 2 }, liftedPieces: { value: 'off', changedAt: 3 } } as const
    expect(settingsStep(account, {}, device, 10)).toEqual({ take: { language: 'ru', liftedPieces: 'off' }, upload: {} })
  })

  it('uploads the device’s own value, as of now, for a setting the account doesn’t hold yet', () => {
    expect(settingsStep({ theme: { value: 'dark', changedAt: 2 } }, {}, device, 10)).toEqual({
      take: { theme: 'dark' },
      upload: { language: { value: 'en', changedAt: 10 }, liftedPieces: { value: 'on', changedAt: 10 } },
    })
  })

  it('neither takes nor uploads a setting changed here that waits to be sent: the backend decides by its time', () => {
    const waiting = { theme: { value: 'light', changedAt: 4 }, liftedPieces: { value: 'off', changedAt: 5 } } as const
    const account = { language: { value: 'en', changedAt: 1 }, theme: { value: 'dark', changedAt: 9 } } as const
    expect(settingsStep(account, waiting, { ...device, theme: 'light', liftedPieces: 'off' }, 10)).toEqual({ take: {}, upload: {} })
  })

  it('keeps the device’s own where the account holds a value this build doesn’t know, and uploads nothing over it', () => {
    const account = { language: 'unknown', theme: { value: 'device', changedAt: 2 }, liftedPieces: { value: 'on', changedAt: 3 } } as const
    expect(settingsStep(account, {}, device, 10)).toEqual({ take: {}, upload: {} })
  })
})

describe('changedSince: what still waits once a send was kept', () => {
  it('lets go of what was sent as it is, and keeps a setting changed again since, or never sent', () => {
    const sent = { language: { value: 'ru', changedAt: 5 }, theme: { value: 'dark', changedAt: 5 } } as const
    const waiting = { language: { value: 'ru', changedAt: 5 }, theme: { value: 'light', changedAt: 6 }, liftedPieces: { value: 'off', changedAt: 6 } } as const
    expect(changedSince(waiting, sent)).toEqual({ theme: { value: 'light', changedAt: 6 }, liftedPieces: { value: 'off', changedAt: 6 } })
    expect(changedSince({}, sent)).toEqual({})
  })
})

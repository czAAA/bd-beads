import { customRef, hasInjectionContext, inject, type InjectionKey, type Ref } from 'vue'
import type { Locale } from '../i18n/translations'
import { DEFAULT_ZOOM_PILL_PLACEMENT, formatPlacement, parsePlacement, type ZoomPillPlacement } from '../domain/zoomPillPlacement'
import { type InputMode } from '../domain/inputMode'
import type { PositionMarkStyle } from '../rendering/positionMarks'
import { CANVAS_BACKGROUND_MAX } from '../rendering/canvasBackgrounds'
import type { ThemePick } from '../theme/theme'

/** One on-device preference: where it is kept, what it is before anyone picks, and how it reads and writes. */
interface Preference<T> {
  key: string
  fallback: T
  /** The value a saved string stands for, or undefined when it is not one (the fallback applies). */
  parse: (raw: string) => T | undefined
  /** The string to keep, or null to forget the saved one (the fallback applies again). */
  write: (value: T) => string | null
}

function preference<T>(spec: Preference<T>): Preference<T> {
  return spec
}

/** An on/off choice that is on until it is switched off. */
function onUntilOff(key: string): Preference<boolean> {
  return preference({ key, fallback: true, parse: (raw) => raw !== 'off', write: (on) => (on ? 'on' : 'off') })
}

/**
 * Every preference kept on this device (ADR 0020), declared once. The storage keys and stored values are the app's
 * long-standing ones, so what people saved before survives.
 *
 * To add a preference: add one declaration here, then read it where it is used with
 * `devicePreferences.get('name')`. Reading, validating, falling back and saving (also when storage is blocked) are
 * handled below, not per preference.
 */
export const PREFERENCES = {
  /** Whether the Rulers toggle is on (Rulers card: on by default). */
  rulers: onUntilOff('bd-beads:rulers'),
  /** Whether the Zoom pill's Row progress toggle shows the Progress bar (ticket 296: on by default). */
  progressBar: onUntilOff('bd-beads:progress-bar'),
  /** Where the phone's Zoom pill rests (tickets 297, 321). Corner names saved before 321 still load, as their corner's placement. */
  zoomPillPlacement: preference<ZoomPillPlacement>({
    key: 'bd-beads:zoom-pill',
    fallback: DEFAULT_ZOOM_PILL_PLACEMENT,
    parse: parsePlacement,
    write: formatPlacement,
  }),
  /** The Canvas color (ticket 252): a number, 1 to 6, so it survives a change of theme. */
  canvasBackground: preference({
    key: 'bd-beads:canvas-background',
    fallback: 1,
    parse: (raw) => {
      const choice = Number(raw)
      return Number.isInteger(choice) && choice >= 1 && choice <= CANVAS_BACKGROUND_MAX ? choice : undefined
    },
    write: String,
  }),
  /** How the open canvas draws its Position marks (ticket 348): Dots until Squares is chosen. Never saved with a Project. */
  positionMarks: preference<PositionMarkStyle>({
    key: 'bd-beads:position-marks',
    fallback: 'dots',
    parse: (raw) => (raw === 'dots' || raw === 'squares' ? raw : undefined),
    write: (style) => (style === 'dots' ? null : style),
  }),
  /** The input mode the person chose (ticket 325): Pen mode or Mouse mode; unset until they choose (ticket 326), so a pen can pick Pen mode. */
  inputMode: preference<InputMode | undefined>({
    key: 'bd-beads:input-mode',
    fallback: undefined,
    parse: (raw) => (raw === 'pen' || raw === 'mouse' ? raw : undefined),
    write: (mode) => mode ?? null,
  }),
  /** Whether a pen has touched this device (ticket 326): the input mode toggle is offered once it has. */
  penSeen: preference<boolean>({
    key: 'bd-beads:pen-seen',
    fallback: false,
    parse: (raw) => raw === 'yes',
    write: (seen) => (seen ? 'yes' : null),
  }),
  /** The theme pick (ticket 139). Match device is no pick at all, so it is not kept. */
  theme: preference<ThemePick>({
    key: 'bd-beads:theme',
    fallback: 'device',
    parse: (raw) => (raw === 'light' || raw === 'dark' || raw === 'contrast' ? raw : undefined),
    write: (pick) => (pick === 'device' ? null : pick),
  }),
  /** The app's language. */
  locale: preference<Locale>({
    key: 'bd-beads:locale',
    fallback: 'en',
    parse: (raw) => (raw === 'en' || raw === 'ru' ? raw : undefined),
    write: (locale) => locale,
  }),
}

export type PreferenceName = keyof typeof PREFERENCES
type PreferenceValue<N extends PreferenceName> = (typeof PREFERENCES)[N] extends Preference<infer T> ? T : never

export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The on-device preferences: each is a ref that holds what was saved and saves itself when set. */
export interface DevicePreferences {
  get: <N extends PreferenceName>(name: N) => Ref<PreferenceValue<N>>
  /** Lets go of what has been read, so the next `get` reads storage afresh. For tests that seed storage between mounts. */
  forget: () => void
}

export function createDevicePreferences(storage: PreferenceStorage): DevicePreferences {
  const refs = new Map<PreferenceName, Ref<unknown>>()

  function open<T>(spec: Preference<T>): Ref<T> {
    let value = spec.fallback
    try {
      const saved = storage.getItem(spec.key)
      if (saved !== null) value = spec.parse(saved) ?? spec.fallback
    } catch {
      // Storage can be blocked (private mode, site data off): the preference starts at its default.
    }
    return customRef((track, trigger) => ({
      get() {
        track()
        return value
      },
      set(next) {
        value = next
        try {
          const kept = spec.write(next)
          if (kept === null) storage.removeItem(spec.key)
          else storage.setItem(spec.key, kept)
        } catch {
          // Storage can be blocked or full; the choice still holds for this visit.
        }
        trigger()
      },
    }))
  }

  return {
    get(name) {
      // One ref per preference, so every reader sees the same value and a change reaches all of them.
      let shared = refs.get(name)
      if (!shared) {
        shared = open<unknown>(PREFERENCES[name] as Preference<unknown>)
        refs.set(name, shared)
      }
      return shared as Ref<PreferenceValue<typeof name>>
    },
    forget: () => refs.clear(),
  }
}

/** This browser's localStorage, looked up on use because even reaching it can throw where site data is blocked. */
const browserStorage: PreferenceStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}

export const browserDevicePreferences: DevicePreferences = createDevicePreferences(browserStorage)

export const devicePreferencesKey: InjectionKey<DevicePreferences> = Symbol('devicePreferences')

/** The app's preferences, as the shell provided them (see provideAppShell); this browser's own outside the app, in an isolated test, say. */
export function useDevicePreferences(): DevicePreferences {
  return (hasInjectionContext() ? inject(devicePreferencesKey, undefined) : undefined) ?? browserDevicePreferences
}

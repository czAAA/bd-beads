import { customRef, hasInjectionContext, inject, type InjectionKey, type Ref } from 'vue'
import type { Locale } from '../i18n/translations'
import { LOCALES } from '../domain/locale'
import { type InputMode } from '../domain/inputMode'
import { CANVAS_BACKGROUND_MAX } from '../rendering/canvasBackgrounds'
import type { ThemePick } from '../theme/theme'
import type { SchemaSizeUnit } from '../domain/projectSize'
import { PILL_POSITIONS, DEFAULT_PILL_POSITION, RECENT_COLORS_KEPT, type PillPosition } from '../domain/toolPill'
import { normalizeHex } from '../domain/palette'
import { readKey, removeKey } from './storageKeys'

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

// Every preference kept on this device (ADR 0020), declared once; keys and values are the long-standing ones so saved
// data survives. To add one, declare it here and read it with `devicePreferences.get('name')`; validating, fallback and
// saving are handled below.
export const PREFERENCES = {
  /** Whether the Rulers toggle is on (Rulers card: on by default). */
  rulers: onUntilOff('openbeads:rulers'),
  /** Whether the Row progress look shows on the Canvas (ticket 474, ADR 0064): on by default; a view setting only. */
  rowHighlight: onUntilOff('openbeads:row-highlight'),
  /** The Canvas color (ticket 252): a number, 1 to 6, so it survives a change of theme. */
  canvasBackground: preference({
    key: 'openbeads:canvas-background',
    fallback: 1,
    parse: (raw) => {
      const choice = Number(raw)
      return Number.isInteger(choice) && choice >= 1 && choice <= CANVAS_BACKGROUND_MAX ? choice : undefined
    },
    write: String,
  }),
  // The input mode the person chose (ticket 325): Pen mode or Mouse mode; unset until they choose (ticket 326), so a
  // pen can pick Pen mode.
  inputMode: preference<InputMode | undefined>({
    key: 'openbeads:input-mode',
    fallback: undefined,
    parse: (raw) => (raw === 'pen' || raw === 'mouse' ? raw : undefined),
    write: (mode) => mode ?? null,
  }),
  /** Whether a pen has touched this device (ticket 326): the input mode toggle is offered once it has. */
  penSeen: preference<boolean>({
    key: 'openbeads:pen-seen',
    fallback: false,
    parse: (raw) => raw === 'yes',
    write: (seen) => (seen ? 'yes' : null),
  }),
  // Whether the note before the browser's storage prompt has been shown on this device (ticket 399): once, then never
  // again.
  storageNoteSeen: preference<boolean>({
    key: 'openbeads:storage-note-seen',
    fallback: false,
    parse: (raw) => raw === 'yes',
    write: (asked) => (asked ? 'yes' : null),
  }),
  /** The theme pick (ticket 139). Match device is no pick at all, so it is not kept. */
  theme: preference<ThemePick>({
    key: 'openbeads:theme',
    fallback: 'device',
    parse: (raw) => (raw === 'light' || raw === 'dark' || raw === 'contrast' ? raw : undefined),
    write: (pick) => (pick === 'device' ? null : pick),
  }),
  // The unit the Frame section states the Schema size in (ticket 342): beads until mm is chosen. Never saved with a
  // Project.
  sizeUnit: preference<SchemaSizeUnit>({
    key: 'openbeads:size-unit',
    fallback: 'beads',
    parse: (raw) => (raw === 'beads' || raw === 'mm' ? raw : undefined),
    write: (unit) => (unit === 'beads' ? null : unit),
  }),
  /** Whether hotkey chips show (ticket 438): unset (auto, by the device) until the Keyboard shortcuts switch is
   * flipped. */
  keyHints: preference<boolean | undefined>({
    key: 'openbeads:key-hints',
    fallback: undefined,
    parse: (raw) => (raw === 'on' ? true : raw === 'off' ? false : undefined),
    write: (on) => (on === undefined ? null : on ? 'on' : 'off'),
  }),
  // Which edge the Tool pill is docked to (ticket 439): bottom until it is moved, and a stored value that is not an
  // edge is bottom too.
  toolPillPosition: preference<PillPosition>({
    key: 'openbeads:tool-pill-position',
    fallback: DEFAULT_PILL_POSITION,
    parse: (raw) => PILL_POSITIONS.find((position) => position === raw),
    write: (position) => (position === DEFAULT_PILL_POSITION ? null : position),
  }),
  // The colours painted with lately, newest first, as `#rrggbb` (ticket 439): at most eight, anything else in storage
  // is dropped.
  recentColors: preference<readonly string[]>({
    key: 'openbeads:recent-colors',
    fallback: [],
    parse: (raw) => raw.split(',').flatMap((hex) => normalizeHex(hex) ?? []).slice(0, RECENT_COLORS_KEPT),
    write: (colors) => (colors.length ? colors.join(',') : null),
  }),
  /** The app's language. */
  locale: preference<Locale>({
    key: 'openbeads:locale',
    fallback: 'en',
    parse: (raw) => LOCALES.find((locale) => locale === raw),
    write: (locale) => locale,
  }),
}

export type PreferenceName = keyof typeof PREFERENCES
type PreferenceValue<N extends PreferenceName> = (typeof PREFERENCES)[N] extends Preference<infer T> ? T : never

export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The on-device preferences: each is a ref that holds what was saved and saves itself when set. */
export interface DevicePreferences {
  get: <N extends PreferenceName>(name: N) => Ref<PreferenceValue<N>>
  /** Lets go of what has been read, so the next `get` reads storage afresh. For tests that seed storage between
   * mounts. */
  forget: () => void
}

export function createDevicePreferences(storage: PreferenceStorage): DevicePreferences {
  const refs = new Map<PreferenceName, Ref<unknown>>()

  function open<T>(spec: Preference<T>): Ref<T> {
    let value = spec.fallback
    try {
      const saved = readKey(storage, spec.key)
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
          if (kept === null) removeKey(storage, spec.key)
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

// The app's preferences, as the shell provided them (see provideAppShell); this browser's own outside the app, in an
// isolated test, say.
export function useDevicePreferences(): DevicePreferences {
  return (hasInjectionContext() ? inject(devicePreferencesKey, undefined) : undefined) ?? browserDevicePreferences
}

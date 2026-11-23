import { BUILD_VERSION } from '../data/build'
import { openPing, utcDay, type OpenPing } from '../domain/appOpened'
import { browserDevicePreferences, type DevicePreferences } from './devicePreferences'

// The day's count of app opens (ticket 1209, ADR 0102): once a UTC day the editor tells the backend it was opened,
// with no credentials and nothing that says who. Nothing is shown and nothing waits for it.

/** The hosts that count: the two Workers the app is served from. Localhost, a tailnet preview or someone else's copy
 * of the app sends nothing. */
const COUNTED_HOSTS = new Set(['openbeads.com', 'dev.openbeads.com'])

/** What the page knows about where and how it runs. @internal Its test stands in for the browser. */
export interface OpenCountPlace {
  host: string
  /** The browser sends Global Privacy Control. */
  privacyControl: boolean
  /** Driven by automation: a test run, a crawler that runs scripts. */
  automated: boolean
  /** Opened as an installed app rather than in a browser tab. */
  installed: boolean
}

/** What one start's count needs. @internal Its test fakes it. */
export interface OpenCountDeps {
  preferences: DevicePreferences
  place: OpenCountPlace
  version: string
  now: () => Date
  /** Posts a ping: true once any answer came back, a refusal too; false when none did (offline, unreachable). */
  post: (ping: OpenPing) => Promise<boolean>
}

/** Sends today's ping unless one was sent today, the count is switched off, the browser asks not to be tracked, or
 * the page isn't the app's own. Any answer settles the day, so a switched-off feature gets no more requests; with no
 * answer the next start tries again. @internal Its test starts a device on given days. */
export async function countThisOpen(deps: OpenCountDeps): Promise<void> {
  const { place, preferences } = deps
  const day = preferences.get('openedDay')
  // Global Privacy Control works as the switch off does: the day kept from before goes too.
  if (place.privacyControl && day.value !== null) day.value = null
  if (!COUNTED_HOSTS.has(place.host) || place.privacyControl || place.automated) return
  const on = preferences.get('countOpens')
  if (!on.value) return
  const today = utcDay(deps.now())
  const ping = openPing(day.value, today, place.installed, deps.version)
  if (!ping || !(await deps.post(ping))) return
  // Switched off while the ping was out: the day is not kept.
  if (on.value) day.value = today
}

/** Switches this device's count on or off. Off removes the day kept for it, so on again counts the device as new. */
export function switchOpenCount(preferences: DevicePreferences, on: boolean): void {
  preferences.get('countOpens').value = on
  if (!on) preferences.get('openedDay').value = null
}

/** Whether this browser sends Global Privacy Control, which the count honors as a switch that can't be turned on. */
export function privacyControlSent(): boolean {
  return typeof navigator !== 'undefined' && (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true
}

function browserPlace(): OpenCountPlace {
  const standalone = (navigator as { standalone?: boolean }).standalone === true
  return {
    host: location.hostname,
    privacyControl: privacyControlSent(),
    automated: navigator.webdriver === true,
    installed: standalone || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches),
  }
}

/** Without credentials, so a signed-in person's ping carries no session cookie and can't be tied to their account.
 * @internal Its test reads the request it makes. */
export async function postPing(ping: OpenPing): Promise<boolean> {
  try {
    await fetch('/api/opened', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ping),
    })
    return true
  } catch {
    return false
  }
}

/** The editor's start (main.ts): counts this open in the background. */
export function startOpenCount(): void {
  void countThisOpen({ preferences: browserDevicePreferences, place: browserPlace(), version: BUILD_VERSION, now: () => new Date(), post: postPing })
}

import { parseSettingsChanges } from '../../src/domain/keptSettings'
import type { Route } from './api'
import { readJson } from './body'
import type { Env } from './env'
import { ApiError, json } from './errors'
import { rateLimit, sizeCap, type RateLimitRule } from './guards'
import { requireAccount } from './sessions'

// The Settings kept in step (ticket 1086, ADR 0014): language and theme, one row per account and
// setting in `core`, unencrypted. A device reads them with `GET /api/me` and sends its changes here; the later change
// wins, setting by setting. The account always comes from the session, so no account reaches another's.

/** Per account: a person changes a setting a few times in a row at most, and each change is one request. */
const SETTINGS_RATE: RateLimitRule = { binding: 'SETTINGS_RATE', periodSeconds: 60 }
/** Not a tuning knob: two settings are under 300 bytes, so this only keeps a flood's body out of memory. */
const SETTINGS_BODY_CAP_BYTES = 4 * 1024

/** A setting as the API sends it: its value and when it was changed, in epoch milliseconds. */
interface HeldSetting {
  value: string
  changedAt: number
}

/** The settings the account holds, by name; none for an account that never sent one. */
export async function settingsOf(env: Env, accountId: string): Promise<Record<string, HeldSetting>> {
  const { results } = await env.CORE.prepare('SELECT name, value, changed_at FROM settings WHERE account_id = ?1')
    .bind(accountId)
    .all<{ name: string; value: string; changed_at: number }>()
  return Object.fromEntries(results.map((row) => [row.name, { value: row.value, changedAt: row.changed_at }]))
}

/** Keeps a change only when it is later than the one held; an equal time changes nothing. */
const KEEP_THE_LATER = `INSERT INTO settings (account_id, name, value, changed_at) VALUES (?1, ?2, ?3, ?4)
  ON CONFLICT (account_id, name) DO UPDATE SET value = excluded.value, changed_at = excluded.changed_at
  WHERE excluded.changed_at > settings.changed_at`

/** `POST /api/settings`: the signed-in account's changed settings, `{ settings: { <name>: { value, changedAt } } }`.
 * Each is kept only when its change is later than the one held, and a time in the future counts as now. Answers with
 * what the account now holds. Anything but the two settings and their own values is `400 bad-request`. */
export const settingsRoute: Route = {
  method: 'POST',
  path: '/api/settings',
  feature: 'settings',
  guards: [sizeCap(() => SETTINGS_BODY_CAP_BYTES)],
  async handler(rc) {
    const account = await requireAccount(rc)
    // Counted per account, so it runs once the session has named one. No Turnstile: a token is single-use (spec 385).
    await rateLimit(SETTINGS_RATE, () => account.id)(rc)
    const changes = parseSettingsChanges(await readJson(rc))
    if (!changes) throw new ApiError('bad-request')
    const now = Date.now()
    const writes = Object.entries(changes).map(([name, { value, changedAt }]) =>
      rc.env.CORE.prepare(KEEP_THE_LATER).bind(account.id, name, value, Math.min(changedAt, now)),
    )
    if (writes.length) await rc.env.CORE.batch(writes)
    return json({ settings: await settingsOf(rc.env, account.id) })
  },
}

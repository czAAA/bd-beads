import { parseOpenPing, utcDay, type OpenPing } from '../../src/domain/appOpened'
import type { Route } from './api'
import { readJson } from './body'
import { numberVar, type Env } from './env'
import { ApiError } from './errors'
import { rateLimit, sizeCap } from './guards'

// Devices that opened the app each UTC day (ticket 1209, ADR 0102): counts per day and combination of a ping's four
// fields in `core`, and nothing else. The handler reads no cookie, address, user agent or `cf` data, and logs none.

/** Not a tuning knob: the longest valid ping is about 80 bytes, so this only keeps a flood's body out of memory. */
const OPENED_BODY_CAP_BYTES = 256

/** Takes one place under today's `OPENS_DAILY_LIMIT` and, only if one was free, adds the ping to its combination's
 * row: one batch, so two pings at once can't both take the last place. Past the ceiling nothing is written but the
 * refused ping, once, so the watchdog sees the day it was reached. A ceiling that isn't a number refuses. */
async function takeOpen(env: Env, ping: OpenPing, now: Date): Promise<boolean> {
  const limit = numberVar(env, 'OPENS_DAILY_LIMIT')
  if (!(limit >= 0)) return false
  const day = utcDay(now)
  const [taken] = await env.CORE.batch<{ opens: number }>([
    env.CORE.prepare(
      `INSERT INTO open_days (day, opens) VALUES (?1, 1)
       ON CONFLICT (day) DO UPDATE SET opens = opens + 1 WHERE opens <= ?2
       RETURNING opens`,
    ).bind(day, limit),
    env.CORE.prepare(
      `INSERT INTO opens (day, first, since, installed, version, opens)
       SELECT ?1, ?2, ?3, ?4, ?5, 1 WHERE (SELECT opens FROM open_days WHERE day = ?1) <= ?6
       ON CONFLICT (day, first, since, installed, version) DO UPDATE SET opens = opens + 1`,
    ).bind(day, ping.first ? 1 : 0, ping.since ?? '', ping.installed ? 1 : 0, ping.version, limit),
  ])
  const opens = taken.results[0]?.opens
  return opens !== undefined && opens <= limit
}

/** Seconds from `now` to the next 00:00 UTC, when the day's ceiling starts again. */
function untilMidnight(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000))
}

/** Today's total, for the watchdog: the ceiling plus one once a ping was refused. */
export async function opensToday(env: Env, now: Date): Promise<number> {
  const row = await env.CORE.prepare('SELECT opens FROM open_days WHERE day = ?1').bind(utcDay(now)).first<{ opens: number }>()
  return row?.opens ?? 0
}

/** `POST /api/opened`: one device opened the app today. `204` with no body; a body not shaped as a ping is `400`
 * before the database is touched; past the day's ceiling, or with none set, a switched-off feature's `503`, waiting
 * until 00:00 UTC. The per-address limit first, then every address together (ticket 1209). */
export const openedRoute: Route = {
  method: 'POST',
  path: '/api/opened',
  feature: 'opens',
  guards: [
    rateLimit({ binding: 'OPENS_RATE', periodSeconds: 60 }),
    rateLimit({ binding: 'OPENS_RATE_ALL', periodSeconds: 60 }, () => 'all'),
    sizeCap(() => OPENED_BODY_CAP_BYTES),
  ],
  async handler(rc) {
    const ping = parseOpenPing(await readJson(rc))
    if (!ping) throw new ApiError('bad-request')
    const now = new Date()
    if (!(await takeOpen(rc.env, ping, now))) throw new ApiError('feature-off', { feature: 'opens' }, untilMidnight(now))
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  },
}

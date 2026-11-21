import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { startWorker, type RunningWorker, type StartOptions } from './harness.ts'

// Ticket 1086, seam 1: the Settings kept in step. `GET /api/me` answers them with the account and `POST
// /api/settings` takes the changed ones, on dev's own origin. A signed-in device is made by writing its account and
// session into `coreDb`, as a sign-in would (signIn.test.ts drives the sign-in itself).

const SITE = 'https://dev.openbeads.com'
const SESSION = '__Host-openbeads-session'
const DAY = 24 * 60 * 60 * 1000

async function withWorker(options: StartOptions, test: (worker: RunningWorker) => Promise<void>): Promise<void> {
  const worker = await startWorker(options)
  try {
    await test(worker)
  } finally {
    await worker.dispose()
  }
}

/** An account with one signed-in device; gives the device's session cookie. */
async function signedIn(worker: RunningWorker, name: string): Promise<string> {
  const session = `session-of-${name}`
  const now = Date.now()
  await worker.coreDb.prepare('INSERT INTO accounts (id, email, google_sub, plan, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(`account-${name}`, `${name}@example.com`, `google-sub-${name}`, 'free', now).run()
  await worker.coreDb
    .prepare('INSERT INTO sessions (id_hash, account_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(createHash('sha256').update(session).digest('base64url'), `account-${name}`, now, now + DAY)
    .run()
  return session
}

const cookie = (session?: string): Record<string, string> => (session === undefined ? {} : { Cookie: `${SESSION}=${session}` })

/** The settings `GET /api/me` answers for the session. */
async function held(worker: RunningWorker, session: string): Promise<unknown> {
  const response = await worker.fetch(`${SITE}/api/me`, { headers: cookie(session) })
  expect(response.status).toBe(200)
  return ((await response.json()) as { settings?: unknown }).settings
}

/** `POST /api/settings` as the app sends it: from the site's own origin, with the session's cookie. */
function send(worker: RunningWorker, session: string | undefined, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return worker.fetch(`${SITE}/api/settings`, {
    method: 'POST',
    headers: { Origin: SITE, 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(text)), ...cookie(session), ...headers },
    body: text,
  })
}

/** Sends changes that must be taken; gives what the account now holds. */
async function change(worker: RunningWorker, session: string, settings: Record<string, { value: string; changedAt: number }>): Promise<unknown> {
  const response = await send(worker, session, { settings })
  expect(response.status).toBe(200)
  return ((await response.json()) as { settings: unknown }).settings
}

describe('the Settings kept in step', () => {
  it('lets a device that still sends the retired Lifted pieces setting be heard, and keeps nothing of it', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const at = Date.now() - 5000
      const answered = await change(worker, ann, { theme: { value: 'dark', changedAt: at }, liftedPieces: { value: 'off', changedAt: at } })
      expect(answered).toEqual({ theme: { value: 'dark', changedAt: at } })
    }))

  it('holds none for a new account, takes the two, and answers them with the account in one request', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      expect(await held(worker, ann)).toEqual({})
      const at = Date.now() - 5000
      const sent = { language: { value: 'ru', changedAt: at }, theme: { value: 'device', changedAt: at } }
      expect(await change(worker, ann, sent)).toEqual(sent)
      const me = await worker.fetch(`${SITE}/api/me`, { headers: cookie(ann) })
      expect(await me.json()).toEqual({ email: 'ann@example.com', plan: 'free', settings: sent })
    }))

  it('keeps the later change, setting by setting: an earlier one arriving late, or one of the same time, changes nothing', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const at = Date.now() - 60_000
      await change(worker, ann, { language: { value: 'ru', changedAt: at }, theme: { value: 'dark', changedAt: at } })
      // Another device, offline since before: its language is older and loses, its theme is newer and wins.
      const answered = await change(worker, ann, { language: { value: 'pl', changedAt: at - 1000 }, theme: { value: 'light', changedAt: at + 1000 } })
      expect(answered).toEqual({ language: { value: 'ru', changedAt: at }, theme: { value: 'light', changedAt: at + 1000 } })
      expect(await change(worker, ann, { language: { value: 'es', changedAt: at } })).toEqual(answered)
      expect(await held(worker, ann)).toEqual(answered)
    }))

  it('counts a change time in the future as now', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const before = Date.now()
      const answered = (await change(worker, ann, { theme: { value: 'contrast', changedAt: before + 365 * DAY } })) as { theme: { value: string; changedAt: number } }
      expect(answered.theme.value).toBe('contrast')
      expect(answered.theme.changedAt).toBeGreaterThanOrEqual(before)
      expect(answered.theme.changedAt).toBeLessThanOrEqual(Date.now())
      // So the next real change still wins.
      await new Promise((resolve) => setTimeout(resolve, 5))
      expect(await change(worker, ann, { theme: { value: 'light', changedAt: Date.now() } })).toMatchObject({ theme: { value: 'light' } })
    }))

  it('refuses 400 anything but the two settings with their own values, and keeps nothing of such a request', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const at = Date.now() - 1000
      const good = { value: 'dark', changedAt: at }
      const refused: unknown[] = [
        'not json',
        [],
        {},
        { settings: [] },
        { settings: { theme: good, makerName: { value: 'Ann', changedAt: at } } },
        { settings: { theme: good, language: { value: 'xx', changedAt: at } } },
        { settings: { theme: { value: 'sepia', changedAt: at } } },
        { settings: { language: { value: true, changedAt: at } } },
        { settings: { theme: { value: 'dark' } } },
        { settings: { theme: { value: 'dark', changedAt: 'yesterday' } } },
        { settings: { theme: { value: 'dark', changedAt: -1 } } },
        { settings: { theme: 'dark' } },
        { settings: { toString: good } },
      ]
      for (const body of refused) {
        const response = await send(worker, ann, body)
        expect(response.status, JSON.stringify(body)).toBe(400)
        expect(await response.json()).toEqual({ error: 'bad-request' })
      }
      expect(await held(worker, ann)).toEqual({})
    }))

  it('refuses 401 signed-out with no session or an unknown one, and 403 a change from another origin', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const settings = { theme: { value: 'dark', changedAt: Date.now() - 1000 } }
      for (const session of [undefined, 'not-a-session']) {
        const response = await send(worker, session, { settings })
        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({ error: 'signed-out' })
      }
      expect((await send(worker, ann, { settings }, { Origin: 'https://evil.example' })).status).toBe(403)
      expect(await held(worker, ann)).toEqual({})
    }))

  it('takes the account from the session alone: one account neither reads nor changes another’s', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const bea = await signedIn(worker, 'bea')
      const at = Date.now() - 1000
      await change(worker, ann, { language: { value: 'uk', changedAt: at } })
      expect(await held(worker, bea)).toEqual({})
      // An account named in the request is one more thing that is not a setting.
      expect((await send(worker, bea, { account: 'account-ann', settings: { language: { value: 'pl', changedAt: at + 1 } } })).status).toBe(200)
      expect((await send(worker, bea, { settings: { language: { value: 'es', changedAt: at + 2, account: 'account-ann' } } })).status).toBe(200)
      expect(await held(worker, ann)).toEqual({ language: { value: 'uk', changedAt: at } })
      expect(await held(worker, bea)).toEqual({ language: { value: 'es', changedAt: at + 2 } })
    }))

  it('lets an account’s settings go with the account', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const bea = await signedIn(worker, 'bea')
      const at = Date.now() - 1000
      await change(worker, ann, { theme: { value: 'dark', changedAt: at } })
      await change(worker, bea, { theme: { value: 'light', changedAt: at } })
      await worker.coreDb.batch([
        worker.coreDb.prepare("DELETE FROM sessions WHERE account_id = 'account-ann'"),
        worker.coreDb.prepare("DELETE FROM accounts WHERE id = 'account-ann'"),
      ])
      expect((await worker.coreDb.prepare('SELECT account_id FROM settings').all()).results).toEqual([{ account_id: 'account-bea' }])
    }))

  it('with settings switched off, refuses a change 503 and still says who is signed in, with no settings', () =>
    withWorker({ vars: { DISABLED_FEATURES: 'settings' } }, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const response = await send(worker, ann, { settings: { theme: { value: 'dark', changedAt: Date.now() - 1000 } } })
      expect(response.status).toBe(503)
      expect(response.headers.get('Retry-After')).toBe('900')
      expect(await response.json()).toEqual({ error: 'feature-off', feature: 'settings' })
      const me = await worker.fetch(`${SITE}/api/me`, { headers: cookie(ann) })
      expect(await me.json()).toEqual({ email: 'ann@example.com', plan: 'free' })
    }))

  it("refuses 429 with Retry-After past wrangler.jsonc's SETTINGS_RATE, counted per account", () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const bea = await signedIn(worker, 'bea')
      const settings = { theme: { value: 'dark', changedAt: Date.now() - 1000 } }
      let limited: Response | undefined
      for (let sent = 0; sent < 40 && !limited; sent++) {
        const response = await send(worker, ann, { settings })
        if (response.status !== 200) limited = response
      }
      expect(limited?.status).toBe(429)
      expect(limited?.headers.get('Retry-After')).toBe('60')
      expect((await send(worker, bea, { settings })).status).toBe(200)
    }))

  it('refuses 413 a body over its cap', () =>
    withWorker({}, async (worker) => {
      const ann = await signedIn(worker, 'ann')
      const response = await send(worker, ann, { settings: {}, padding: 'x'.repeat(5000) })
      expect(response.status).toBe(413)
    }))
})

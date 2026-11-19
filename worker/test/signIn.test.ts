import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { startWorker, type Outbound, type RunningWorker, type StartOptions } from './harness.ts'

// Ticket 0078, seam 1: signing in with Google, `GET /api/me` and Sign out, with Google's token answer faked at the
// harness's outbound seam. Asked on dev's own origin, as `PUBLIC_ORIGIN` in `wrangler.jsonc` names it.

const SITE = 'https://dev.openbeads.com'
const TURNSTILE_PASSES = '1x0000000000000000000000000000000AA'
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CLIENT_ID = '616858853393-fsl5tbh3829ejhh7vb4331rdoqk3m62v.apps.googleusercontent.com'
/** A token the fake verifier says was solved in another form's widget. */
const FEEDBACK_FORM_TOKEN = 'solved-for-feedback'
const SESSION = '__Host-openbeads-session'
const SIGN_IN = '__Host-openbeads-sign-in'

/** What Google's ID token says of the person signing in. */
type Claims = Record<string, unknown>
const ann = (over: Claims = {}): Claims => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  exp: Math.floor(Date.now() / 1000) + 3600,
  sub: 'google-sub-ann',
  email: 'ann@example.com',
  email_verified: true,
  // Google sends these when asked for more; the Worker asks for `openid email` and keeps neither.
  name: 'Ann Example',
  picture: 'https://example.com/ann.png',
  ...over,
})

const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** Answers siteverify as Cloudflare does for a token solved on the site, in the sign-in widget unless it is the other
 * form's, and Google's token exchange with an ID token holding `person()`'s claims. */
function fakes(person: () => Claims | number): NonNullable<StartOptions['reply']> {
  return ({ url, body }: Outbound) => {
    if (url.startsWith(SITEVERIFY)) {
      const form = new URLSearchParams(body)
      const action = form.get('response') === FEEDBACK_FORM_TOKEN ? 'feedback' : 'sign-in'
      return Response.json({ success: form.get('secret') === TURNSTILE_PASSES, hostname: new URL(SITE).hostname, action })
    }
    if (url === GOOGLE_TOKEN_URL) {
      const claims = person()
      if (typeof claims === 'number') return Response.json({ error: 'invalid_grant' }, { status: claims })
      return Response.json({ access_token: 'ya29.unused', id_token: `${part({ alg: 'RS256' })}.${part(claims)}.signature` })
    }
    return new Response('unexpected', { status: 500 })
  }
}

interface Site {
  worker: RunningWorker
  /** Who Google says signs in next: claims, or the status its token exchange fails with. */
  google: { person: Claims | number }
}

async function withSite(options: StartOptions, test: (site: Site) => Promise<void>): Promise<void> {
  const google = { person: ann() as Claims | number }
  const worker = await startWorker({
    reply: fakes(() => google.person),
    ...options,
    vars: { TURNSTILE_SECRET_KEY: TURNSTILE_PASSES, GOOGLE_CLIENT_SECRET: 'google-secret-test', ...options.vars },
  })
  try {
    await test({ worker, google })
  } finally {
    await worker.dispose()
  }
}

/** The cookies a response sets, by name, with the whole `Set-Cookie` line. */
function cookiesOf(response: Response): Record<string, { value: string; line: string }> {
  return Object.fromEntries(
    response.headers.getSetCookie().map((line) => {
      const [pair = ''] = line.split(';')
      const at = pair.indexOf('=')
      return [pair.slice(0, at), { value: pair.slice(at + 1), line }]
    }),
  )
}

const cookieHeader = (cookies: Record<string, string>) => Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')

/** `POST /api/auth/google/start` as the Subpanel sends it: from the site's own origin, with a Turnstile token. */
function start(worker: RunningWorker, headers: Record<string, string> = {}, query = '?return=/app/'): Promise<Response> {
  return worker.fetch(`${SITE}/api/auth/google/start${query}`, {
    method: 'POST',
    headers: { Origin: SITE, 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX', ...headers },
  })
}

/** Google's way back: the address it redirects to, carrying the cookie `start` set. */
function callback(worker: RunningWorker, query: Record<string, string>, signInCookie?: string, headers: Record<string, string> = {}): Promise<Response> {
  return worker.fetch(`${SITE}/api/auth/google/callback?${new URLSearchParams(query)}`, {
    redirect: 'manual',
    headers: { ...headers, ...(signInCookie === undefined ? {} : { Cookie: cookieHeader({ [SIGN_IN]: signInCookie }) }) },
  })
}

let visitors = 0

/** One whole sign-in as a browser makes it, from an address of its own (the limit is per address); gives the
 * callback's answer and the session cookie it set, if any. */
async function signIn(worker: RunningWorker, query = '?return=/app/'): Promise<{ response: Response; session?: string }> {
  const from = { 'CF-Connecting-IP': `198.51.100.${++visitors}` }
  const started = await start(worker, from, query)
  expect(started.status).toBe(200)
  const { url } = (await started.json()) as { url: string }
  const state = new URL(url).searchParams.get('state')!
  const response = await callback(worker, { code: 'google-code', state }, cookiesOf(started)[SIGN_IN]!.value, from)
  return { response, session: cookiesOf(response)[SESSION]?.value }
}

const me = (worker: RunningWorker, session?: string) =>
  worker.fetch(`${SITE}/api/me`, { headers: session === undefined ? {} : { Cookie: cookieHeader({ [SESSION]: session }) } })

const signOut = (worker: RunningWorker, session: string, headers: Record<string, string> = { Origin: SITE }) =>
  worker.fetch(`${SITE}/api/auth/sign-out`, { method: 'POST', headers: { Cookie: cookieHeader({ [SESSION]: session }), ...headers } })

const rows = async <Row>(worker: RunningWorker, sql: string) => (await worker.coreDb.prepare(sql).all<Row>()).results

/** A session `core` holds for a cookie id, as the Worker hashes it. */
const hashOf = (id: string) => createHash('sha256').update(id).digest('base64url')

describe('signing in with Google', () => {
  it("answers Google's address for `openid email` only, with the state, the PKCE challenge and PUBLIC_ORIGIN's callback", () =>
    withSite({}, async ({ worker }) => {
      const started = await start(worker)
      expect(started.status).toBe(200)
      const address = new URL(((await started.json()) as { url: string }).url)
      expect(`${address.origin}${address.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      const query = Object.fromEntries(address.searchParams)
      expect(query).toMatchObject({
        client_id: CLIENT_ID,
        redirect_uri: `${SITE}/api/auth/google/callback`,
        response_type: 'code',
        scope: 'openid email',
        code_challenge_method: 'S256',
      })
      const cookie = cookiesOf(started)[SIGN_IN]!
      expect(cookie.line).toMatch(/; Path=\/; Max-Age=600; HttpOnly; Secure; SameSite=Lax$/)
      const [state, verifier, returnPath] = cookie.value.split('.')
      expect(query.state).toBe(state)
      expect(query.code_challenge).toBe(hashOf(verifier!))
      expect(returnPath).toBe('/app/')
    }))

  it('creates the account at the first sign-in, starts a 90-day session and returns to the editor signed in', () =>
    withSite({}, async ({ worker }) => {
      const before = Date.now()
      const { response, session } = await signIn(worker, '?return=/ru/app/')
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/ru/app/?account=signed-in')
      const cookies = cookiesOf(response)
      expect(cookies[SESSION]!.line).toMatch(/; Path=\/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax$/)
      expect(cookies[SIGN_IN]!.line).toContain('Max-Age=0')

      const exchange = worker.outbound.find(({ url }) => url === GOOGLE_TOKEN_URL)!
      expect(Object.fromEntries(new URLSearchParams(exchange.body))).toMatchObject({
        grant_type: 'authorization_code',
        code: 'google-code',
        client_id: CLIENT_ID,
        client_secret: 'google-secret-test',
        redirect_uri: `${SITE}/api/auth/google/callback`,
      })

      const answer = await me(worker, session)
      expect(answer.status).toBe(200)
      expect(await answer.json()).toEqual({ email: 'ann@example.com', plan: 'free' })

      // Nothing else of the person is stored: no name, no picture, no token; and the session's id only as its hash.
      const accounts = await rows<Record<string, unknown>>(worker, 'SELECT * FROM accounts')
      expect(accounts).toEqual([{ id: expect.any(String), email: 'ann@example.com', google_sub: 'google-sub-ann', plan: 'free', created_at: expect.any(Number) }])
      const sessions = await rows<{ id_hash: string; account_id: string; created_at: number; expires_at: number }>(worker, 'SELECT * FROM sessions')
      expect(sessions).toEqual([{ id_hash: hashOf(session!), account_id: accounts[0]!.id, created_at: expect.any(Number), expires_at: expect.any(Number) }])
      expect(sessions[0]!.created_at).toBeGreaterThanOrEqual(before)
      expect(sessions[0]!.expires_at - sessions[0]!.created_at).toBe(90 * 24 * 60 * 60 * 1000)
    }))

  it('finds the account at the second sign-in, and by Google’s id when the address has changed', () =>
    withSite({}, async ({ worker, google }) => {
      google.person = ann({ email: 'Ann@Example.com' })
      await signIn(worker)
      const again = await signIn(worker)
      expect(await (await me(worker, again.session)).json()).toEqual({ email: 'ann@example.com', plan: 'free' })

      google.person = ann({ email: 'ann.new@example.com' })
      const moved = await signIn(worker)
      expect(await (await me(worker, moved.session)).json()).toEqual({ email: 'ann.new@example.com', plan: 'free' })
      expect(await rows(worker, 'SELECT email, google_sub FROM accounts')).toEqual([{ email: 'ann.new@example.com', google_sub: 'google-sub-ann' }])
    }))

  it('gives an account that has no Google id, as an email link makes it, the id of the person who proves its address', () =>
    withSite({}, async ({ worker }) => {
      await worker.coreDb.prepare("INSERT INTO accounts (id, email, plan, created_at) VALUES ('account-1', 'ann@example.com', 'free', 1)").run()
      const { session } = await signIn(worker)
      expect((await me(worker, session)).status).toBe(200)
      expect(await rows(worker, 'SELECT id, google_sub FROM accounts')).toEqual([{ id: 'account-1', google_sub: 'google-sub-ann' }])
    }))

  it('signs the verified address in to its account under another Google id, and leaves that id as it was', () =>
    withSite({}, async ({ worker }) => {
      await worker.coreDb.prepare("INSERT INTO accounts (id, email, google_sub, plan, created_at) VALUES ('account-1', 'ann@example.com', 'google-sub-earlier', 'free', 1)").run()
      const { session } = await signIn(worker)
      expect(await (await me(worker, session)).json()).toEqual({ email: 'ann@example.com', plan: 'free' })
      expect(await rows(worker, 'SELECT id, google_sub FROM accounts')).toEqual([{ id: 'account-1', google_sub: 'google-sub-earlier' }])
    }))

  it('refuses an ID token that fails a check, and signs nobody in', () =>
    withSite({}, async ({ worker, google }) => {
      const refused: Array<[string, Claims | number]> = [
        ['an unverified address', ann({ email_verified: false })],
        ['another issuer', ann({ iss: 'https://accounts.example.com' })],
        ['another client', ann({ aud: 'someone-else.apps.googleusercontent.com' })],
        ['a token past its time', ann({ exp: Math.floor(Date.now() / 1000) - 60 })],
        ['no address', ann({ email: undefined })],
        ['a code Google refuses', 400],
      ]
      for (const [why, person] of refused) {
        google.person = person
        const { response, session } = await signIn(worker)
        expect(response.headers.get('Location'), why).toBe('/app/?account=failed')
        expect(session, why).toBeUndefined()
      }
      expect(await rows(worker, 'SELECT * FROM accounts')).toEqual([])
      expect(await rows(worker, 'SELECT * FROM sessions')).toEqual([])
    }))

  it('refuses a state that is not the cookie’s, or no cookie, without asking Google', () =>
    withSite({}, async ({ worker }) => {
      const started = await start(worker)
      const cookie = cookiesOf(started)[SIGN_IN]!.value
      for (const response of [await callback(worker, { code: 'google-code', state: 'someone-elses-state' }, cookie), await callback(worker, { code: 'google-code', state: cookie.split('.')[0]! })]) {
        expect(response.status).toBe(302)
        expect(response.headers.get('Location')).toBe('/app/?account=failed')
        expect(cookiesOf(response)[SESSION]).toBeUndefined()
      }
      expect(worker.outbound.some(({ url }) => url === GOOGLE_TOKEN_URL)).toBe(false)
    }))

  it('returns a person who said no at Google as cancelled', () =>
    withSite({}, async ({ worker }) => {
      const started = await start(worker)
      const cookie = cookiesOf(started)[SIGN_IN]!.value
      const response = await callback(worker, { error: 'access_denied', state: cookie.split('.')[0]! }, cookie)
      expect(response.headers.get('Location')).toBe('/app/?account=cancelled')
      expect(worker.outbound.some(({ url }) => url === GOOGLE_TOKEN_URL)).toBe(false)
    }))

  it('returns only to the editor: any other address asked for becomes /app/', () =>
    withSite({}, async ({ worker }) => {
      for (const asked of ['https://evil.example/app/', '//evil.example/app/', '/app/../x', '/api/me', '']) {
        const started = await start(worker, { 'CF-Connecting-IP': '203.0.113.1' }, `?return=${encodeURIComponent(asked)}`)
        expect(cookiesOf(started)[SIGN_IN]!.value.split('.')[2], asked).toBe('/app/')
      }
    }))

  it('with sign-up switched off, creates nothing for an unknown address and still signs a known account in', () =>
    withSite({ vars: { DISABLED_FEATURES: 'sign-up' } }, async ({ worker, google }) => {
      const unknown = await signIn(worker)
      expect(unknown.response.headers.get('Location')).toBe('/app/?account=paused')
      expect(unknown.session).toBeUndefined()
      expect(await rows(worker, 'SELECT * FROM accounts')).toEqual([])

      await worker.coreDb.prepare("INSERT INTO accounts (id, email, google_sub, plan, created_at) VALUES ('account-1', 'bea@example.com', 'google-sub-bea', 'free', 1)").run()
      google.person = ann({ sub: 'google-sub-bea', email: 'bea@example.com' })
      const known = await signIn(worker)
      expect(known.response.headers.get('Location')).toBe('/app/?account=signed-in')
      expect(await (await me(worker, known.session)).json()).toEqual({ email: 'bea@example.com', plan: 'free' })
    }))

  it('with sign-in switched off, nobody signs in: start and status answer 503, and Google’s way back returns to the editor', () =>
    withSite({ vars: { DISABLED_FEATURES: 'sign-in' } }, async ({ worker }) => {
      for (const response of [await start(worker), await worker.fetch(`${SITE}/api/auth/status`)]) {
        expect(response.status).toBe(503)
        expect(response.headers.get('Retry-After')).toBe('900')
        expect(await response.json()).toEqual({ error: 'feature-off', feature: 'sign-in' })
      }
      const back = await callback(worker, { code: 'google-code', state: 'state' }, 'state.verifier./ru/app/')
      expect(back.status).toBe(302)
      expect(back.headers.get('Location')).toBe('/ru/app/?account=failed')
      expect(worker.outbound).toHaveLength(0)
    }))

  it('says sign-in can be started on PUBLIC_ORIGIN, and nowhere else', () =>
    withSite({}, async ({ worker }) => {
      const here = await worker.fetch(`${SITE}/api/auth/status`)
      expect(here.status).toBe(200)
      expect(await here.json()).toEqual({ signIn: true })
      // Google lists no redirect address on `workers.dev`, so a sign-in started there could never come back.
      const elsewhere = await worker.fetch('https://bd-beads-dev.bd4beads.workers.dev/api/auth/status')
      expect(elsewhere.status).toBe(503)
      expect(await elsewhere.json()).toEqual({ error: 'feature-off', feature: 'sign-in' })
    }))

  it('answers 503 when the client secret is not set', () =>
    withSite({ vars: { GOOGLE_CLIENT_SECRET: undefined } }, async ({ worker }) => {
      expect((await worker.fetch(`${SITE}/api/auth/status`)).status).toBe(503)
      expect((await start(worker)).status).toBe(503)
    }))

  it('refuses 403 a start without a Turnstile token, with one solved for another form, or from another origin', () =>
    withSite({}, async ({ worker }) => {
      for (const token of ['', FEEDBACK_FORM_TOKEN]) {
        const response = await start(worker, { 'X-Turnstile-Token': token })
        expect(response.status, token).toBe(403)
        expect(await response.json()).toEqual({ error: 'turnstile-failed' })
        expect(cookiesOf(response)[SIGN_IN]).toBeUndefined()
      }
      const foreign = await start(worker, { Origin: 'https://evil.example' })
      expect(foreign.status).toBe(403)
      expect(await foreign.json()).toEqual({ error: 'forbidden-origin' })
    }))

  it("refuses 429 with Retry-After past wrangler.jsonc's SIGN_IN_RATE, per address, and returns a limited way back to the editor", () =>
    withSite({}, async ({ worker }) => {
      const from = { 'CF-Connecting-IP': '203.0.113.9' }
      for (let sent = 1; sent <= 6; sent++) expect((await start(worker, from)).status, `start ${sent}`).toBe(200)
      const refused = await start(worker, from)
      expect(refused.status).toBe(429)
      expect(refused.headers.get('Retry-After')).toBe('60')
      expect((await start(worker, { 'CF-Connecting-IP': '203.0.113.10' })).status).toBe(200)

      const back = await worker.fetch(`${SITE}/api/auth/google/callback?code=c&state=s`, { redirect: 'manual', headers: from })
      expect(back.status).toBe(302)
      expect(back.headers.get('Location')).toBe('/app/?account=failed')
    }))
})

describe('GET /api/me and Sign out', () => {
  it('answers 401 signed-out with no session, an unknown one, or one past its time', () =>
    withSite({}, async ({ worker }) => {
      const { session } = await signIn(worker)
      for (const cookie of [undefined, 'not-a-session']) {
        const response = await me(worker, cookie)
        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({ error: 'signed-out' })
      }
      await worker.coreDb.prepare('UPDATE sessions SET expires_at = ?1').bind(Date.now() - 1).run()
      expect((await me(worker, session)).status).toBe(401)
    }))

  it("deletes the sessions past their time in the watchdog's daily run, and leaves the others", () =>
    withSite({}, async ({ worker }) => {
      const ended = await signIn(worker)
      await worker.coreDb.prepare('UPDATE sessions SET expires_at = 1').run()
      const live = await signIn(worker)
      await worker.scheduled(new Date('2026-11-19T00:05:00Z'))
      expect(await rows(worker, 'SELECT id_hash FROM sessions')).toEqual([{ id_hash: hashOf(live.session!) }])
      expect((await me(worker, ended.session)).status).toBe(401)
      expect((await me(worker, live.session)).status).toBe(200)
    }))

  it('ends this device’s session only: the same account stays signed in on another, and another account is untouched', () =>
    withSite({}, async ({ worker, google }) => {
      const phone = await signIn(worker)
      const laptop = await signIn(worker)
      google.person = ann({ sub: 'google-sub-bea', email: 'bea@example.com' })
      const bea = await signIn(worker)

      const response = await signOut(worker, phone.session!)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ signedOut: true })
      expect(cookiesOf(response)[SESSION]!.line).toMatch(/^__Host-openbeads-session=; Path=\/; Max-Age=0; HttpOnly; Secure; SameSite=Lax$/)

      expect((await me(worker, phone.session)).status).toBe(401)
      expect(await (await me(worker, laptop.session)).json()).toEqual({ email: 'ann@example.com', plan: 'free' })
      expect(await (await me(worker, bea.session)).json()).toEqual({ email: 'bea@example.com', plan: 'free' })
      expect(await rows(worker, 'SELECT id_hash FROM sessions ORDER BY created_at')).toHaveLength(2)
    }))

  it('refuses a Sign out from another origin, and answers one with no session the same as any', () =>
    withSite({ vars: { DISABLED_FEATURES: 'sign-in' } }, async ({ worker }) => {
      const foreign = await signOut(worker, 'any', { Origin: 'https://evil.example' })
      expect(foreign.status).toBe(403)
      // Signing out works while sign-in is switched off.
      const none = await signOut(worker, 'not-a-session')
      expect(none.status).toBe(200)
      expect(await none.json()).toEqual({ signedOut: true })
    }))

  it('names its cookies without the prefix and Secure on a Worker run by hand on http://localhost', () =>
    withSite({ vars: { PUBLIC_ORIGIN: 'http://localhost' } }, async ({ worker }) => {
      const started = await worker.fetch('/api/auth/google/start?return=/app/', { method: 'POST', headers: { Origin: 'http://localhost', 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' } })
      // The fake verifier answers for the site's hostname, so only the cookie's shape is asked here.
      expect(started.status).toBe(403)
      const cleared = await worker.fetch('/api/auth/sign-out', { method: 'POST', headers: { Origin: 'http://localhost' } })
      expect(cookiesOf(cleared)['openbeads-session']!.line).toBe('openbeads-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax')
    }))
})

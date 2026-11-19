import { accountForGoogle } from './accounts'
import type { Route } from './api'
import { readCookie, setCookie } from './cookies'
import type { Env } from './env'
import { ApiError, json } from './errors'
import { disabledFeatures, FEATURE_OFF_RETRY_SECONDS } from './features'
import { googleAddress, googleIdentity, type GoogleClient } from './google'
import { rateLimit, turnstile, type RateLimitRule } from './guards'
import { randomId } from './secrets'
import { endSession, requireAccount, startSession } from './sessions'
import { settingsOf } from './settings'

// Sign in with Google and Sign out (ticket 0078, spec 385). The app asks `start` for Google's address and sends the
// person there; Google sends them to `callback`, which starts the session and returns them to the editor with a mark
// in the address the app reads and removes. A refusal on the way back is a mark too, never a JSON answer.

/** The cookie that carries one sign-in to Google and back: its `state`, its PKCE verifier and where it started. */
const SIGN_IN_COOKIE = 'openbeads-sign-in'
/** How long a person has at Google before the sign-in must be started again. */
const SIGN_IN_SECONDS = 10 * 60
/** Per IP, counted for `start` and `callback` together: one sign-in takes two. */
const SIGN_IN_RATE: RateLimitRule = { binding: 'SIGN_IN_RATE', periodSeconds: 60 }
/** The action the Sign in Subpanel's Turnstile widget names, so a token solved for another form is refused. */
const TURNSTILE_ACTION = 'sign-in'

/** The editor, under a language's folder or not (ticket 1053): the only addresses a sign-in returns to. */
const EDITOR_PATH = /^\/(?:[a-z]{2}\/)?app\/$/
const EDITOR = '/app/'
/** The mark the editor reads and removes: `src/domain/account.ts` knows the same name and values. */
const RETURN_MARK = 'account'
type Return = 'signed-in' | 'cancelled' | 'failed' | 'paused'

/** Sign-in can't be offered: answered like the switched-off feature, so the app says "temporarily unavailable". */
const unavailable = () => new ApiError('feature-off', { feature: 'sign-in' }, FEATURE_OFF_RETRY_SECONDS)

/** The OAuth client, where sign-in can run: on `PUBLIC_ORIGIN` alone (Google lists no other redirect address, so not
 * on `workers.dev`), with the client's id and secret set. */
function googleClient(env: Env, url: URL): GoogleClient {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.PUBLIC_ORIGIN) {
    console.error('sign-in: no GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET or PUBLIC_ORIGIN')
    throw unavailable()
  }
  if (url.origin !== env.PUBLIC_ORIGIN) throw unavailable()
  return { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, origin: env.PUBLIC_ORIGIN }
}

/** The sign-in this browser started, from its cookie. */
function startedSignIn(request: Request, env: Env): { state: string; verifier: string; returnPath: string } | null {
  const [state, verifier, returnPath, ...rest] = (readCookie(request, env, SIGN_IN_COOKIE) ?? '').split('.')
  if (!state || !verifier || !returnPath || rest.length || !EDITOR_PATH.test(returnPath)) return null
  return { state, verifier, returnPath }
}

/** Sends the person back to the editor they left, marked with how the sign-in ended; the sign-in's cookie is spent
 * either way. A path of this origin, never an address from the request. */
function backToEditor(request: Request, env: Env, how: Return, session?: string): Response {
  const path = startedSignIn(request, env)?.returnPath ?? EDITOR
  const response = new Response(null, { status: 302, headers: { Location: `${path}?${RETURN_MARK}=${how}`, 'Cache-Control': 'no-store' } })
  response.headers.append('Set-Cookie', setCookie(env, SIGN_IN_COOKIE, '', 0))
  if (session) response.headers.append('Set-Cookie', session)
  return response
}

/** `GET /api/auth/status`: whether a sign-in can be started now, asked by a press on the Menu's "Sign in" before the
 * Subpanel opens (MenuPanel card). Nothing is read or written. */
const signInStatusRoute: Route = {
  method: 'GET',
  path: '/api/auth/status',
  feature: 'sign-in',
  handler({ env, url }) {
    googleClient(env, url)
    return json({ signIn: true })
  },
}

/** `POST /api/auth/google/start?return=<the editor's path>`: Google's address for one sign-in, asking for `openid
 * email` only. Its `state` and PKCE verifier stay in a ten-minute cookie with the path to return to. */
const signInStartRoute: Route = {
  method: 'POST',
  path: '/api/auth/google/start',
  feature: 'sign-in',
  // The per-address limit first, so a flood from one address never reaches the verifier (as feedback's, ticket 1024).
  guards: [rateLimit(SIGN_IN_RATE), turnstile(TURNSTILE_ACTION)],
  async handler({ env, url }) {
    const client = googleClient(env, url)
    const asked = url.searchParams.get('return') ?? ''
    const state = randomId()
    const verifier = randomId()
    const response = json({ url: await googleAddress(client, state, verifier) })
    const started = [state, verifier, EDITOR_PATH.test(asked) ? asked : EDITOR].join('.')
    response.headers.append('Set-Cookie', setCookie(env, SIGN_IN_COOKIE, started, SIGN_IN_SECONDS))
    return response
  },
}

/** `GET /api/auth/google/callback`: Google's way back. Checks `state` against the cookie, exchanges the code, finds or
 * makes the account and starts its session; then, signed in or refused, returns the person to the editor. */
const signInCallbackRoute: Route = {
  method: 'GET',
  path: '/api/auth/google/callback',
  feature: 'sign-in',
  guards: [rateLimit(SIGN_IN_RATE)],
  // A switch that is off or a limit reached returns to the editor too: the Subpanel says it didn't work, and the next
  // press on its button gets the refusal itself, with its wait.
  refuse: (_error, request, env) => backToEditor(request, env, 'failed'),
  async handler({ request, env, url }) {
    const back = (how: Return, session?: string) => backToEditor(request, env, how, session)
    const started = startedSignIn(request, env)
    const answer = url.searchParams
    if (!started || answer.get('state') !== started.state) return back('failed')
    if (answer.has('error')) return back(answer.get('error') === 'access_denied' ? 'cancelled' : 'failed')
    const code = answer.get('code')
    if (!code) return back('failed')
    const now = Date.now()
    const identity = await googleIdentity(googleClient(env, url), code, started.verifier, now)
    if (!identity) return back('failed')
    const account = await accountForGoogle(env, identity, now)
    if (account === 'paused') return back('paused')
    return back('signed-in', await startSession(env, account.id, now))
  },
}

/** `GET /api/me`: the signed-in account's email and plan, or `401 signed-out`. The account comes from the session. Its
 * Settings kept in step ride along (ticket 1086), so a device that opens the app asks once; with the `settings` switch
 * off the answer holds none. */
const meRoute: Route = {
  method: 'GET',
  path: '/api/me',
  async handler(rc) {
    const { id, email, plan } = await requireAccount(rc)
    const settings = disabledFeatures(rc.env).has('settings') ? undefined : await settingsOf(rc.env, id)
    return json({ email, plan, settings })
  },
}

/** `POST /api/auth/sign-out`: ends this device's session, and no other, and clears its cookie. Works while sign-in is
 * switched off, and answers the same with no session. */
const signOutRoute: Route = {
  method: 'POST',
  path: '/api/auth/sign-out',
  async handler(rc) {
    const response = json({ signedOut: true })
    response.headers.append('Set-Cookie', await endSession(rc))
    return response
  },
}

/** Every route of signing in, for the Worker's list. */
export const signInRoutes: Route[] = [signInStatusRoute, signInStartRoute, signInCallbackRoute, meRoute, signOutRoute]

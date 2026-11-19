import type { RequestContext } from './api'
import { readCookie, setCookie } from './cookies'
import type { Env } from './env'
import { ApiError } from './errors'
import { base64url, randomId, sha256 } from './secrets'

// Sessions (ticket 0078): a signed-in device holds a random id in a cookie, and `core` holds that id's hash with the
// account and the time the session ends. Every route that acts for an account takes it from here, never from the
// request, so no account reaches another's.

/** The session cookie's name, before its `__Host-` prefix. */
const SESSION_COOKIE = 'openbeads-session'
/** A session lasts 90 days from the sign-in and is not made longer by use (glossary: Sign in / Sign out). */
const SESSION_SECONDS = 90 * 24 * 60 * 60

/** The signed-in account, as the API knows it. */
export interface Account {
  id: string
  email: string
  plan: string
}

/** A session id as `core` keeps it: its hash, so a copy of the table signs nobody in. */
async function hashOf(id: string): Promise<string> {
  return base64url(await sha256(id))
}

/** The account the request's session belongs to; null with no session, an unknown one or one past its time. */
async function sessionAccount({ request, env }: Pick<RequestContext, 'request' | 'env'>): Promise<Account | null> {
  const id = readCookie(request, env, SESSION_COOKIE)
  if (!id) return null
  return env.CORE.prepare(
    `SELECT accounts.id, accounts.email, accounts.plan FROM sessions JOIN accounts ON accounts.id = sessions.account_id
     WHERE sessions.id_hash = ?1 AND sessions.expires_at > ?2`,
  )
    .bind(await hashOf(id), Date.now())
    .first<Account>()
}

/** The signed-in account, or `401 signed-out`: what a route for signed-in people starts with. */
export async function requireAccount(rc: Pick<RequestContext, 'request' | 'env'>): Promise<Account> {
  const account = await sessionAccount(rc)
  if (!account) throw new ApiError('signed-out')
  return account
}

/** Starts a session for the account on this device; returns the `Set-Cookie` that holds its id. */
export async function startSession(env: Env, accountId: string, now: number): Promise<string> {
  const id = randomId()
  await env.CORE.prepare('INSERT INTO sessions (id_hash, account_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(await hashOf(id), accountId, now, now + SESSION_SECONDS * 1000)
    .run()
  return setCookie(env, SESSION_COOKIE, id, SESSION_SECONDS)
}

/** Ends the request's own session, if it has one, and no other; returns the `Set-Cookie` that clears the cookie. */
export async function endSession({ request, env }: Pick<RequestContext, 'request' | 'env'>): Promise<string> {
  const id = readCookie(request, env, SESSION_COOKIE)
  if (id) await env.CORE.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await hashOf(id)).run()
  return clearedSession(env)
}

/** The `Set-Cookie` that clears this device's session cookie, once its session is gone. */
export function clearedSession(env: Env): string {
  return setCookie(env, SESSION_COOKIE, '', 0)
}

/** Deletes the sessions past their time, so the table doesn't grow: the watchdog's daily work. */
export async function deleteEndedSessions(env: Env, now: Date): Promise<void> {
  await env.CORE.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(now.getTime()).run()
}

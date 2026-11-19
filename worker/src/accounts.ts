import { deleteBlobsOf } from './blobs'
import type { Env } from './env'
import { disabledFeatures } from './features'
import type { Account } from './sessions'

// Accounts (ticket 0078, ADR 0014): one verified email address each. The first sign-in with an unknown address makes
// the account, so there is no separate sign-up.

/** What a Sign-in method proved: the verified address, and Google's own id for the person. */
export interface GoogleIdentity {
  sub: string
  email: string
}

const FIELDS = 'id, email, plan'

/** The account a Google sign-in reaches, or `paused` for an unknown address while the `sign-up` switch is off. Google's
 * id finds it first, so a person whose address changed is still the same account, and it then shows the new one. */
export async function accountForGoogle(env: Env, identity: GoogleIdentity, now: number): Promise<Account | 'paused'> {
  const email = identity.email.toLowerCase()
  const db = env.CORE
  const known = await db.prepare(`SELECT ${FIELDS} FROM accounts WHERE google_sub = ?1`).bind(identity.sub).first<Account>()
  if (known) {
    if (known.email === email) return known
    // Left as it was when another account already holds the new address: an address belongs to one account.
    const moved = await db.prepare(`UPDATE OR IGNORE accounts SET email = ?2 WHERE id = ?1 RETURNING ${FIELDS}`).bind(known.id, email).first<Account>()
    return moved ?? known
  }
  // The address is the account (ADR 0014): one made by an email link has no Google id and takes this one, so both
  // Sign-in methods reach it. One that already has another id keeps it, and the verified address still signs in.
  const byEmail = await db
    .prepare(`UPDATE accounts SET google_sub = COALESCE(google_sub, ?2) WHERE email = ?1 RETURNING ${FIELDS}`)
    .bind(email, identity.sub)
    .first<Account>()
  if (byEmail) return byEmail
  if (disabledFeatures(env).has('sign-up')) return 'paused'
  // Two first sign-ins at once make one account: the second insert is ignored and reads the first's row.
  await db
    .prepare('INSERT OR IGNORE INTO accounts (id, email, google_sub, plan, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(crypto.randomUUID(), email, identity.sub, 'free', now)
    .run()
  const made = await db.prepare(`SELECT ${FIELDS} FROM accounts WHERE email = ?1`).bind(email).first<Account>()
  if (!made) throw new Error('accounts: the new account could not be read back')
  return made
}

/** Deletes an account and everything kept for it (ticket 0082, ADR 0049): its blobs first, then its sessions, its
 * Settings kept in step and the account in one batch. Each step is safe to repeat, so a retry finishes a deletion that
 * failed halfway, and no blob is ever left without an account. */
export async function deleteAccount(env: Env, id: string): Promise<void> {
  await deleteBlobsOf(env, id)
  await env.CORE.batch([
    env.CORE.prepare('DELETE FROM sessions WHERE account_id = ?1').bind(id),
    env.CORE.prepare('DELETE FROM settings WHERE account_id = ?1').bind(id),
    env.CORE.prepare('DELETE FROM accounts WHERE id = ?1').bind(id),
  ])
}

// The account a signed-in person has (ticket 0078, ADR 0014): one verified email address and a plan. No name and no
// picture: neither is stored.

/** The plans (glossary: Free account, Pro). */
type AccountPlan = 'free' | 'pro'

/** The signed-in account, as the Menu's Account section shows it. */
export interface Account {
  email: string
  plan: AccountPlan
}

/** An account from stored or sent data, or undefined when it is not one. A plan this build doesn't know reads as the
 * Free account: nothing here depends on the plan yet. */
export function parseAccount(value: unknown): Account | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { email, plan } = value as { email?: unknown; plan?: unknown }
  if (typeof email !== 'string' || !email.includes('@')) return undefined
  return { email, plan: plan === 'pro' ? 'pro' : 'free' }
}

/** How a sign-in ended, as Google's way back marks the editor's address (`worker/src/signIn.ts`). */
export type SignInReturn = 'signed-in' | SignInRefusal
/** Why the person is not signed in after a try: they said no at Google, something failed, or new accounts are paused
 * (the `sign-up` switch). */
export type SignInRefusal = 'cancelled' | 'failed' | 'paused'

const RETURNS: readonly SignInReturn[] = ['signed-in', 'cancelled', 'failed', 'paused']
/** The mark's name in the address: `?account=signed-in`. */
export const SIGN_IN_RETURN_PARAM = 'account'

/** How the sign-in a query string (`location.search`) marks ended; undefined for an address with no mark. */
export function parseSignInReturn(search: string): SignInReturn | undefined {
  const mark = new URLSearchParams(search).get(SIGN_IN_RETURN_PARAM)
  return RETURNS.find((known) => known === mark)
}

/** How long a wait reads in a toast, as the Worker's `Retry-After` gives it: seconds up to a minute, then minutes. */
export function waitOf(seconds: number): { unit: 'seconds' | 'minutes'; count: number } {
  return seconds > 60 ? { unit: 'minutes', count: Math.ceil(seconds / 60) } : { unit: 'seconds', count: Math.max(1, Math.ceil(seconds)) }
}

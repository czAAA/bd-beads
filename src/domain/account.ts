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
type SignInReturn = 'signed-in' | SignInRefusal
/** Why the person is not signed in after a try: they said no at Google, something failed, or new accounts are paused
 * (the `sign-up` switch). */
export type SignInRefusal = 'cancelled' | 'failed' | 'paused'

/** What the editor's address marks: how a sign-in ended, or `sign-in`, the Homepage's Create free account asking for
 * the Sign in Subpanel (ticket 0391). */
export type AccountMark = SignInReturn | 'sign-in'

const MARKS: readonly AccountMark[] = ['signed-in', 'cancelled', 'failed', 'paused', 'sign-in']
/** The mark's name in the address: `?account=signed-in`. */
export const SIGN_IN_RETURN_PARAM = 'account'

/** What a query string (`location.search`) marks; undefined for an address with no mark. */
export function parseSignInReturn(search: string): AccountMark | undefined {
  const mark = new URLSearchParams(search).get(SIGN_IN_RETURN_PARAM)
  return MARKS.find((known) => known === mark)
}

/** The editor's address that opens on the Sign in Subpanel: where the Homepage's Create free account leads. */
export function signInAddress(editor: string): string {
  return `${editor}?${SIGN_IN_RETURN_PARAM}=sign-in`
}

/** How long a wait reads in a toast, as the Worker's `Retry-After` gives it: seconds up to a minute, then minutes. */
export function waitOf(seconds: number): { unit: 'seconds' | 'minutes'; count: number } {
  return seconds > 60 ? { unit: 'minutes', count: Math.ceil(seconds / 60) } : { unit: 'seconds', count: Math.max(1, Math.ceil(seconds)) }
}

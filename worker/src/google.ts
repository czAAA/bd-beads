import { decodeJson } from './access'
import type { GoogleIdentity } from './accounts'
import { base64url, sha256 } from './secrets'

// Google as a Sign-in method (ticket 0078): the authorization-code flow with PKCE, asking for `openid email` only.
// The Worker keeps what the ID token proves, the verified address and Google's id for the person, and drops the tokens.

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
/** The issuer of Google's ID tokens, in the two spellings Google documents. */
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

/** The path Google sends the person back to; listed on the OAuth client for each origin (ticket 0400). */
const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback'

/** The OAuth client and the origin its redirect address is listed for. */
export interface GoogleClient {
  id: string
  secret: string
  /** `PUBLIC_ORIGIN`, never the request's host. */
  origin: string
}

const redirectUri = (client: GoogleClient) => `${client.origin}${GOOGLE_CALLBACK_PATH}`

/** Google's address for one sign-in: `state` ties the answer to this browser, the verifier's hash to this request. */
export async function googleAddress(client: GoogleClient, state: string, verifier: string): Promise<string> {
  const query = new URLSearchParams({
    client_id: client.id,
    redirect_uri: redirectUri(client),
    response_type: 'code',
    scope: 'openid email',
    state,
    code_challenge: base64url(await sha256(verifier)),
    code_challenge_method: 'S256',
  })
  return `${AUTHORIZE_URL}?${query}`
}

/** Exchanges Google's code for who signed in, or null when Google refuses it or its ID token fails a check: the
 * issuer, the audience (this client), the expiry and a verified address. The token comes straight from Google over
 * TLS, which stands in for checking its signature (OpenID Connect Core 3.1.3.7). */
export async function googleIdentity(client: GoogleClient, code: string, verifier: string, now: number): Promise<GoogleIdentity | null> {
  let answer: { id_token?: unknown }
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        client_id: client.id,
        client_secret: client.secret,
        redirect_uri: redirectUri(client),
      }),
    })
    if (!response.ok) {
      console.error(`sign-in: google's token answer was ${response.status}`)
      return null
    }
    answer = await response.json()
  } catch (error) {
    console.error('sign-in: google unreachable', error)
    return null
  }
  const claims = typeof answer.id_token === 'string' ? (decodeJson(answer.id_token.split('.')[1] ?? '') as Record<string, unknown> | null) : null
  if (!claims || typeof claims !== 'object') return null
  const { iss, aud, exp, sub, email, email_verified: verified } = claims
  if (typeof iss !== 'string' || !ISSUERS.includes(iss) || aud !== client.id) return null
  if (typeof exp !== 'number' || exp * 1000 <= now) return null
  // Google sends the mark as a boolean, and as the string in some older answers.
  if (verified !== true && verified !== 'true') return null
  if (typeof sub !== 'string' || !sub || typeof email !== 'string' || !email.includes('@')) return null
  return { sub, email }
}

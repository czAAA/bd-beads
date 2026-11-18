import type { Env } from './env'
import { ApiError } from './errors'

/** The team's signing keys by key id, as last fetched, and when they were last asked for (failed or not). One copy per
 * isolate. */
let teamKeys: { team: string; keys: Map<string, CryptoKey>; askedAt: number } | null = null
/** Keys are fetched again after this long, or sooner when a token names a key not seen, at most once a minute. */
const KEYS_KEPT_MS = 60 * 60 * 1000
const REFETCH_AT_MOST_EVERY_MS = 60 * 1000
/** Seconds of clock difference between Access and the Worker that a token's times may be off by. */
const LEEWAY_SECONDS = 60

/** Ticket 395: the refusal of a request without a valid Cloudflare Access token for the application of the host it came
 * in on, so that a mistake in the Access setup can't open dev; null to let it through. Checks only where `ACCESS_AUD`
 * is set: dev, not production. */
export async function accessRefusal(request: Request, env: Env): Promise<Response | null> {
  if (!env.ACCESS_AUD) return null
  const audience = env.ACCESS_AUD[new URL(request.url).hostname]
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion')
  const valid = !!audience && !!env.ACCESS_TEAM_DOMAIN && !!jwt && (await validToken(jwt, env.ACCESS_TEAM_DOMAIN, audience))
  return valid ? null : new ApiError('access-required').toResponse()
}

interface Claims {
  iss?: unknown
  aud?: unknown
  exp?: unknown
  nbf?: unknown
}

/** An RS256 token signed with one of the team's keys, issued by the team, for this audience, and within its times. */
async function validToken(jwt: string, team: string, audience: string): Promise<boolean> {
  const parts = jwt.split('.')
  if (parts.length !== 3) return false
  const [head, body, signature] = parts
  const header = decodeJson(head) as { alg?: unknown; kid?: unknown } | null
  const claims = decodeJson(body) as Claims | null
  if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string') return false
  const key = await signingKey(team, header.kid)
  const bytes = base64urlBytes(signature)
  if (!key || !bytes) return false
  const signed = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes, new TextEncoder().encode(`${head}.${body}`))
  if (!signed) return false
  const now = Date.now() / 1000
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  return (
    claims.iss === team &&
    audiences.includes(audience) &&
    typeof claims.exp === 'number' &&
    claims.exp + LEEWAY_SECONDS > now &&
    (claims.nbf === undefined || (typeof claims.nbf === 'number' && claims.nbf - LEEWAY_SECONDS <= now))
  )
}

/** The team's key with this id, fetched from its certs endpoint; null when there is none or they can't be fetched. */
async function signingKey(team: string, kid: string): Promise<CryptoKey | null> {
  const kept = teamKeys?.team === team ? teamKeys : null
  const age = kept ? Date.now() - kept.askedAt : Number.POSITIVE_INFINITY
  const known = age < KEYS_KEPT_MS ? kept?.keys.get(kid) : undefined
  if (known || age < REFETCH_AT_MOST_EVERY_MS) return known ?? null
  teamKeys = { team, keys: kept?.keys ?? new Map(), askedAt: Date.now() }
  try {
    teamKeys.keys = await fetchKeys(team)
  } catch (error) {
    console.error("Access: the team's keys could not be fetched", error)
    return null
  }
  return teamKeys.keys.get(kid) ?? null
}

async function fetchKeys(team: string): Promise<Map<string, CryptoKey>> {
  const response = await fetch(`${team}/cdn-cgi/access/certs`)
  if (!response.ok) throw new Error(`certs answered ${response.status}`)
  const { keys } = await response.json<{ keys: Array<JsonWebKey & { kid: string }> }>()
  const imported = await Promise.all(
    keys.map(async (jwk) => {
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
      return [jwk.kid, key] as const
    }),
  )
  return new Map(imported)
}

function base64urlBytes(text: string): Uint8Array | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

function decodeJson(text: string): unknown {
  const bytes = base64urlBytes(text)
  if (!bytes) return null
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

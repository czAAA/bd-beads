// Random ids and their hashes (ticket 0078), for the session cookie and the sign-in's `state` and PKCE verifier.

/** Bytes as base64url, the form a cookie, an address and PKCE all take as they are. */
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A random id of 256 bits, as base64url (43 characters): nobody guesses one. */
export function randomId(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

/** The SHA-256 of `text`. */
export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

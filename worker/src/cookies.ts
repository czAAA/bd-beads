import type { Env } from './env'

// The Worker's two cookies (ticket 0078): the session, and the short one that carries a sign-in to Google and back.
// Both are `HttpOnly; Secure; SameSite=Lax` and named `__Host-…`, so no script reads them and no other host of the
// domain (dev is a subdomain of production's) can set one for this host.

/** Whether this Worker is used over https. Only a Worker run by hand on `http://localhost` is not: a browser refuses
 * a `__Host-` cookie there, so its cookies go without the prefix and without `Secure`. */
function secure(env: Env): boolean {
  return !env.PUBLIC_ORIGIN?.startsWith('http://')
}

/** A cookie's name as this Worker sets and reads it. */
function cookieName(env: Env, name: string): string {
  return secure(env) ? `__Host-${name}` : name
}

/** The value of the request's cookie `name`, or null. */
export function readCookie(request: Request, env: Env, name: string): string | null {
  const wanted = cookieName(env, name)
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const at = part.indexOf('=')
    if (at > 0 && part.slice(0, at).trim() === wanted) return part.slice(at + 1).trim()
  }
  return null
}

/** A `Set-Cookie` value keeping `value` for `maxAgeSeconds`; 0 clears the cookie. Values are base64url or hex, so
 * nothing needs escaping. */
export function setCookie(env: Env, name: string, value: string, maxAgeSeconds: number): string {
  const attributes = ['Path=/', `Max-Age=${maxAgeSeconds}`, 'HttpOnly', ...(secure(env) ? ['Secure'] : []), 'SameSite=Lax']
  return `${cookieName(env, name)}=${value}; ${attributes.join('; ')}`
}

import { webcrypto } from 'node:crypto'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { unstable_readConfig } from 'wrangler'
import { startWorker, type Outbound, type RunningWorker } from './harness.ts'

// Ticket 395: dev answers nobody outside Cloudflare Access, not even /api/health. Access puts a token signed with the
// team's keys in `Cf-Access-Jwt-Assertion`; the Worker checks it against the application of the host asked.

const dev = unstable_readConfig({ config: join(resolve(import.meta.dirname, '../..'), 'wrangler.jsonc'), env: 'dev' })
const TEAM = String(dev.vars.ACCESS_TEAM_DOMAIN)
const AUDIENCES = dev.vars.ACCESS_AUD as Record<string, string>
const CUSTOM_DOMAIN = 'dev.openbeads.com'
const WORKERS_DEV = Object.keys(AUDIENCES).find((host) => host.endsWith('.workers.dev')) ?? ''
const NOW = () => Math.floor(Date.now() / 1000)

interface SigningKey {
  kid: string
  privateKey: webcrypto.CryptoKey
  jwk: webcrypto.JsonWebKey
}

async function signingKey(kid: string): Promise<SigningKey> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  return { kid, privateKey: pair.privateKey, jwk: await crypto.subtle.exportKey('jwk', pair.publicKey) }
}

const base64url = (bytes: Uint8Array | string) => Buffer.from(bytes).toString('base64url')

/** A token as Access issues it: RS256, the team as issuer, the application's tag as audience, valid for an hour. */
async function token(key: SigningKey, claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const head = base64url(JSON.stringify({ alg: 'RS256', kid: key.kid, typ: 'JWT', ...header }))
  const body = base64url(
    JSON.stringify({ iss: TEAM, aud: [AUDIENCES[CUSTOM_DOMAIN]], iat: NOW(), nbf: NOW(), exp: NOW() + 3600, ...claims }),
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(`${head}.${body}`))
  return `${head}.${body}.${base64url(new Uint8Array(signature))}`
}

const withToken = (jwt: string): RequestInit => ({ headers: { 'Cf-Access-Jwt-Assertion': jwt } })

describe("dev's Access check", () => {
  let team: SigningKey
  let worker: RunningWorker
  beforeAll(async () => {
    team = await signingKey('team-key')
    worker = await startWorker({
      access: true,
      vars: { VERSION: 'abc1234' },
      reply: (call: Outbound) =>
        call.url === `${TEAM}/cdn-cgi/access/certs`
          ? Response.json({ keys: [{ ...team.jwk, kid: team.kid, alg: 'RS256', use: 'sig' }] })
          : new Response('unreachable', { status: 503 }),
    })
  })
  afterAll(() => worker.dispose())

  it('refuses /api/health and every other /api path without a token, with 403', async () => {
    for (const path of ['/api/health', '/api/health/x', '/api/nothing-here']) {
      const response = await worker.fetch(`https://${CUSTOM_DOMAIN}${path}`)
      expect(response.status, path).toBe(403)
      expect(await response.json()).toEqual({ error: 'access-required' })
    }
  })

  it("lets a token for the custom domain's application through on the custom domain", async () => {
    const response = await worker.fetch(`https://${CUSTOM_DOMAIN}/api/health`, withToken(await token(team)))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, worker: 'dev', version: 'abc1234' })
  })

  it("lets a token for workers.dev's application through on workers.dev, and refuses each host's on the other", async () => {
    const forWorkersDev = await token(team, { aud: [AUDIENCES[WORKERS_DEV]] })
    const forCustomDomain = await token(team)
    expect((await worker.fetch(`https://${WORKERS_DEV}/api/health`, withToken(forWorkersDev))).status).toBe(200)
    expect((await worker.fetch(`https://${WORKERS_DEV}/api/health`, withToken(forCustomDomain))).status).toBe(403)
    expect((await worker.fetch(`https://${CUSTOM_DOMAIN}/api/health`, withToken(forWorkersDev))).status).toBe(403)
  })

  it('refuses any token on a host with no application of its own', async () => {
    expect((await worker.fetch('http://localhost/api/health', withToken(await token(team)))).status).toBe(403)
  })

  it('refuses a token that is expired, not yet valid, from another team, or signed with another key', async () => {
    const stranger = await signingKey(team.kid)
    const refused = {
      expired: await token(team, { exp: NOW() - 60 }),
      'not yet valid': await token(team, { nbf: NOW() + 600 }),
      'another team': await token(team, { iss: 'https://someone.cloudflareaccess.com' }),
      'another key': await token(stranger),
      'an unknown key id': await token(team, {}, { kid: 'nobody' }),
      'alg none, unsigned': (await token(team, {}, { alg: 'none' })).replace(/[^.]+$/, ''),
      'alg HS256': await token(team, {}, { alg: 'HS256' }),
      'not a token': 'not.a.token',
    }
    for (const [why, jwt] of Object.entries(refused)) {
      const response = await worker.fetch(`https://${CUSTOM_DOMAIN}/api/health`, withToken(jwt))
      expect(response.status, why).toBe(403)
    }
  })

  it("refuses, and doesn't crash, when the team's keys can't be fetched", async () => {
    const fresh = await startWorker({ access: true, reply: () => new Response('down', { status: 503 }) })
    try {
      const response = await fresh.fetch(`https://${CUSTOM_DOMAIN}/api/health`, withToken(await token(team)))
      expect(response.status).toBe(403)
    } finally {
      await fresh.dispose()
    }
  })

  it('serves the app from the static assets without asking for a token (Access guards them)', async () => {
    expect((await worker.fetch(`https://${CUSTOM_DOMAIN}/`)).status).toBe(200)
  })
})

describe("production's Access check", () => {
  it('is off: health answers without a token', async () => {
    const worker = await startWorker({ env: 'production', access: true })
    try {
      expect((await worker.fetch('https://openbeads.com/api/health')).status).toBe(200)
    } finally {
      await worker.dispose()
    }
  })
})

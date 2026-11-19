import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TURNSTILE_SITE_KEY } from './turnstile'

describe('TURNSTILE_SITE_KEY', () => {
  it('is the site key wrangler.jsonc gives both Workers', () => {
    const keys = [...readFileSync('wrangler.jsonc', 'utf8').matchAll(/"TURNSTILE_SITE_KEY":\s*"([^"]+)"/g)].map((match) => match[1])
    expect(keys.length).toBeGreaterThan(0)
    expect(new Set(keys)).toEqual(new Set([TURNSTILE_SITE_KEY]))
  })
})

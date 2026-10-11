import { describe, expect, it } from 'vitest'
import { resolveBase } from './vite.base.ts'

describe('resolveBase', () => {
  it('defaults to /bd-beads/ in production', () => {
    expect(resolveBase('production', undefined)).toBe('/bd-beads/')
    expect(resolveBase('production', '')).toBe('/bd-beads/')
    expect(resolveBase('production', '  ')).toBe('/bd-beads/')
  })

  it('honours DEPLOY_BASE in production', () => {
    expect(resolveBase('production', '/app/')).toBe('/app/')
    expect(resolveBase('production', '/')).toBe('/')
  })

  it('adds the missing slashes', () => {
    expect(resolveBase('production', 'app')).toBe('/app/')
    expect(resolveBase('production', '/nested/app')).toBe('/nested/app/')
  })

  it('serves the dev server from / whatever DEPLOY_BASE says', () => {
    expect(resolveBase('development', '/app/')).toBe('/')
  })
})

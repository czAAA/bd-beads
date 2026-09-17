import { describe, expect, it } from 'vitest'
import { isRichMirrorEnabled } from './featureFlags'

describe('isRichMirrorEnabled', () => {
  it('is on when the env var is exactly "true"', () => {
    expect(isRichMirrorEnabled({ VITE_RICH_MIRROR: 'true' })).toBe(true)
  })

  it('is off when the env var is missing', () => {
    expect(isRichMirrorEnabled({})).toBe(false)
  })

  it.each(['TRUE', 'True', '1', 'false', 'yes', ''])('is off for any other value (%s)', (value) => {
    expect(isRichMirrorEnabled({ VITE_RICH_MIRROR: value })).toBe(false)
  })

  it('defaults to reading import.meta.env, which .env pins to true for every build', () => {
    expect(isRichMirrorEnabled()).toBe(true)
  })
})

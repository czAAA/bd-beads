import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOLD_MS } from './hold'

describe('HOLD_MS (ticket 1065)', () => {
  it('is the length the CSS draws the hairline over: --hold-duration, in the app and in the design system', () => {
    for (const file of ['../styles/design-values.css', '../../docs/design/system/components/bundle.css']) {
      const css = readFileSync(resolve(__dirname, file), 'utf8')
      expect(/--hold-duration:\s*(\d+)ms/.exec(css)?.[1], file).toBe(String(HOLD_MS))
    }
  })
})

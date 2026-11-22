import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CANVAS_HOLD_MS, TOOLTIP_HOLD_MS } from './hold'

describe('CANVAS_HOLD_MS (tickets 1065, 1167)', () => {
  it('is 450ms: the ring opens sooner than a control\'s Tooltip long-press', () => {
    expect(CANVAS_HOLD_MS).toBe(450)
    expect(CANVAS_HOLD_MS).toBeLessThan(TOOLTIP_HOLD_MS)
  })

  it('is the length the CSS draws the hairline over: --hold-duration, in the app and in the design system', () => {
    for (const file of ['../styles/design-values.css', '../../docs/design/system/components/bundle.css']) {
      const css = readFileSync(resolve(__dirname, file), 'utf8')
      expect(/--hold-duration:\s*(\d+)ms/.exec(css)?.[1], file).toBe(String(CANVAS_HOLD_MS))
    }
  })

  it('shows the hairline nothing for its first 300ms (--hold-quiet), then draws it over the last 150ms, in the app and in the design system', () => {
    for (const file of ['../styles/design-values.css', '../../docs/design/system/components/bundle.css']) {
      const css = readFileSync(resolve(__dirname, file), 'utf8')
      const quiet = Number(/--hold-quiet:\s*(\d+)ms/.exec(css)?.[1])
      expect(quiet, file).toBe(300)
      expect(CANVAS_HOLD_MS - quiet, file).toBe(150)
    }
  })
})

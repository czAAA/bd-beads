import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CANVAS_HOLD_MS, TOOLTIP_HOLD_MS } from './hold'

describe('CANVAS_HOLD_MS (tickets 1065, 1167)', () => {
  it('is 350ms: the ring opens sooner than a control\'s Tooltip long-press', () => {
    expect(CANVAS_HOLD_MS).toBe(350)
    expect(CANVAS_HOLD_MS).toBeLessThan(TOOLTIP_HOLD_MS)
  })

  it('is the length the CSS draws the hairline over: --hold-duration, in the app and in the design system', () => {
    for (const file of ['../styles/design-values.css', '../../docs/design/system/components/bundle.css']) {
      const css = readFileSync(resolve(__dirname, file), 'utf8')
      expect(/--hold-duration:\s*(\d+)ms/.exec(css)?.[1], file).toBe(String(CANVAS_HOLD_MS))
    }
  })
})

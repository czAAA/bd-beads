import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { channelsOf, contrastRatio } from '../domain/color'

// The `ai` color (ticket 0764, ADR 0087) draws the AI mark and the AI Loading: a meaningful mark at 3:1 by the
// rules, held here to text's 4.5:1 on every surface it sits on, so the sparkle reads at 15px.
const tokens = readFileSync(join(__dirname, 'tokens.css'), 'utf8')

function token(theme: string, name: string): string {
  const selector = theme === 'light' ? ':root[data-theme="light"] {' : `:root[data-theme="${theme}"] {`
  const start = tokens.indexOf(selector)
  const block = tokens.slice(start, tokens.indexOf('}', start))
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(block)![1]!.trim()
}

describe.each(['light', 'dark', 'contrast'])('the ai color in %s', (theme) => {
  it.each(['canvas', 'surface', 'panel', 'elevated', 'box'])('reaches 4.5:1 on %s', (surface) => {
    expect(contrastRatio(channelsOf(token(theme, 'ai')), channelsOf(token(theme, surface)))).toBeGreaterThanOrEqual(4.5)
  })
})

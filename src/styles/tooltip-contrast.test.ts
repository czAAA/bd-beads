import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { channelsOf, mix, relativeLuminance, type Rgb } from '../domain/color'

// The see-through Tooltip (ticket 327) must pass WCAG 4.5:1 over black and white canvas colors; its fill alpha and
// `tooltip-muted` clear both.
const tokens = readFileSync(join(__dirname, 'tokens.css'), 'utf8')
const values = readFileSync(join(__dirname, 'design-values.css'), 'utf8')

function block(css: string, theme: string): string {
  const start = css.indexOf(`:root[data-theme="${theme}"] {`)
  return css.slice(start, css.indexOf('}', start))
}

function token(css: string, theme: string, name: string): string {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(block(css, theme))![1]!.trim()
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe.each(['light', 'dark', 'contrast'])('the Tooltip in %s', (theme) => {
  const themeValues = (name: string) => {
    const start = values.indexOf(theme === 'light' ? ':root,\n:root[data-theme="light"] {' : `:root[data-theme="${theme}"] {`)
    const body = values.slice(start, values.indexOf('}', start))
    return new RegExp(`--${name}:\\s*([^;]+);`).exec(body)![1]!.trim()
  }
  const resolve = (value: string): string => {
    const ref = /^var\(--([a-z-]+)\)$/.exec(value)
    return ref ? token(tokens, theme, ref[1]!) : value
  }
  const fill = themeValues('tooltip-fill')
  const alpha = fill.startsWith('color-mix') ? Number(/(\d+)%/.exec(fill)![1]) / 100 : 1
  const surface = channelsOf(token(tokens, theme, 'elevated'))
  const text = [token(tokens, theme, 'ink'), resolve(themeValues('tooltip-muted'))]

  it.each([0, 255])('keeps its text at 4.5:1 or more over a canvas of %i', (under) => {
    const bubble = mix({ r: under, g: under, b: under }, surface, alpha)
    for (const color of text) expect(ratio(bubble, channelsOf(color))).toBeGreaterThanOrEqual(4.5)
  })
})

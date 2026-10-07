import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Tooltip is see-through (ticket 327), so its text has to pass WCAG 4.5:1 over any canvas color under it. The worst
 * cases are black and white under the bubble's fill; the fill's alpha and `tooltip-muted` are chosen to clear both.
 */
const tokens = readFileSync(join(__dirname, 'tokens.css'), 'utf8')
const values = readFileSync(join(__dirname, 'design-values.css'), 'utf8')

function block(css: string, theme: string): string {
  const start = css.indexOf(`:root[data-theme="${theme}"] {`)
  return css.slice(start, css.indexOf('}', start))
}

function token(css: string, theme: string, name: string): string {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(block(css, theme))![1]!.trim()
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

function luminance([r, g, b]: number[]): number {
  const [lr, lg, lb] = [r!, g!, b!].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!
}

function ratio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
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
  const surface = rgb(token(tokens, theme, 'elevated'))
  const text = [token(tokens, theme, 'ink'), resolve(themeValues('tooltip-muted'))]

  it.each([0, 255])('keeps its text at 4.5:1 or more over a canvas of %i', (under) => {
    const bubble = surface.map((v) => v * alpha + under * (1 - alpha))
    for (const color of text) expect(ratio(bubble, rgb(color))).toBeGreaterThanOrEqual(4.5)
  })
})

import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = resolve(__dirname, '..')

/** The radius scale (tokens.json's `radius` family), the only corners the app's UI may have (ticket 1079). */
const tokens = JSON.parse(readFileSync(resolve(src, '../docs/design/system/tokens.json'), 'utf8')) as { radius: { tokens: { name: string }[] } }
const SCALE = tokens.radius.tokens.map(({ name }) => name)

/** Names that stand for a step of the scale (`canvasBars.test.ts` holds its value to `radius-lg`). */
const SCALE_NAMES = ['canvas-box-radius']

/** Drawing geometry, not UI corners: DOM outlines that trace the corners the Canvas draws (ticket 1078). */
const DRAWING_GEOMETRY = ['margin-sheet-radius', 'margin-border-radius', 'piece-line-radius']

const allowed = new Set([...SCALE, ...SCALE_NAMES, ...DRAWING_GEOMETRY])
const fromScale = new Set([...SCALE, ...SCALE_NAMES])

function styleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name)
    return entry.isDirectory() ? styleFiles(path) : /\.(css|vue)$/.test(path) ? [path] : []
  })
}

/** The top-level parts of a radius value: `0 var(--radius-sm) calc(…)` gives three, a `/` is a separator. */
function parts(value: string): string[] {
  const found: string[] = []
  let depth = 0
  let part = ''
  for (const char of value) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (depth === 0 && (/\s/.test(char) || char === '/')) {
      if (part) found.push(part)
      part = ''
    } else part += char
  }
  if (part) found.push(part)
  return found
}

function onScale(part: string): boolean {
  if (part === '0' || part === 'inherit') return true
  const single = /^var\(--([a-z0-9-]+)\)$/.exec(part)
  if (single) return allowed.has(single[1])
  if (!part.startsWith('calc(')) return false
  return [...part.matchAll(/var\(--([a-z0-9-]+)\)/g)].some(([, name]) => fromScale.has(name))
}

/** Every radius in `text` that is not from the scale, as `line: declaration`; comments are skipped. */
function radiiOffScale(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
  return [...code.matchAll(/(?<![\w-])border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/g)]
    .filter(([, value]) => !parts(value.replace(/!important/, '').trim()).every(onScale))
    .map((match) => `${code.slice(0, match.index).split('\n').length}: ${match[0].trim()}`)
}

describe('every corner takes its radius from the scale (ticket 1079)', () => {
  it('passes a scale token, 0, inherit and a calc() made from a scale token', () => {
    const ok = `a { border-radius: var(--radius-md); }
      b { border-radius: 0 var(--radius-sm) var(--radius-sm) 0 }
      c { border-top-left-radius: calc(var(--radius-xs) + var(--line) / 2); border-radius: inherit; }
      d { border-radius: var(--margin-sheet-radius) }
      :root { --margin-border-radius: 6px }
      /* e { border-radius: 10px } */`
    expect(radiiOffScale(ok)).toEqual([])
  })

  it('fails a raw length or percentage, a one-off variable and a calc() with no scale token, naming the line', () => {
    const bad = 'a { border-radius: 10px; }\nb { border-radius: 50% }\nc { border-radius: var(--popover-radius) }\n' +
      'd { border-radius: var(--space-4) }\ne { border-bottom-right-radius: calc(var(--line) * 2) }\nf { border-radius: 0 3px }'
    expect(radiiOffScale(bad)).toEqual([
      '1: border-radius: 10px',
      '2: border-radius: 50%',
      '3: border-radius: var(--popover-radius)',
      '4: border-radius: var(--space-4)',
      '5: border-bottom-right-radius: calc(var(--line) * 2)',
      '6: border-radius: 0 3px',
    ])
  })

  it('holds for every stylesheet and component in the app', () => {
    const offenders = styleFiles(src).flatMap((file) =>
      radiiOffScale(readFileSync(file, 'utf8')).map((line) => `${relative(src, file)}:${line}`),
    )
    expect(offenders).toEqual([])
  })
})

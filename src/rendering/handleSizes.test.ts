import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HANDLE_HOT_DISC_ALPHA, HANDLE_PX } from './handleSizes'

const repo = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const declared = (path: string) => new Map([...read(path).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
const sheets = ['src/styles/design-values.css', 'docs/design/system/components/bundle.css'].map((path) => [path, declared(path)] as const)
const families = Object.values(JSON.parse(read('docs/design/system/tokens.json')) as Record<string, { tokens?: { name: string; value: string }[] }>)
const touchTarget = families.flatMap((family) => family.tokens ?? []).find(({ name }) => name === 'touch-target')?.value

/** Each value of `HANDLE_PX` and the custom property AppHandle draws it from (Handle card). */
const TWINS: [number | string, string][] = [
  [HANDLE_PX.bracket.arm, '--handle-arm'],
  [HANDLE_PX.bracket.line, '--handle-line'],
  [HANDLE_PX.bracket.radius, '--handle-radius'],
  [HANDLE_PX.bracket.offset, '--handle-offset'],
  [HANDLE_PX.hot.arm, '--handle-hot-arm'],
  [HANDLE_PX.hot.line, '--handle-hot-line'],
  [HANDLE_PX.hot.disc, '--handle-hot-disc'],
  [HANDLE_PX.bar.length, '--handle-bar-length'],
  [HANDLE_PX.bar.thickness, '--handle-bar-thickness'],
  [HANDLE_PX.reach.fine, '--handle-reach'],
  [HANDLE_PX.reach.touch, '--handle-reach-touch'],
]

describe('the handle (Handle card, ticket 0867)', () => {
  it.each(TWINS)('%s px is %s, in the app and the design system alike', (px, name) => {
    for (const [path, values] of sheets) expect(values.get(name), `${name} in ${path}`).toBe(`${px}px`)
  })

  it('fills its hot disc as the CSS does', () => {
    for (const [path, values] of sheets) expect(values.get('--handle-hot-disc-alpha'), path).toBe(String(HANDLE_HOT_DISC_ALPHA))
  })

  it('reaches half the touch target round its centre for a finger: a 44px touch area', () => {
    expect(`${HANDLE_PX.reach.touch * 2}px`).toBe(touchTarget)
  })
})

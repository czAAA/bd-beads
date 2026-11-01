import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from './AppIcon.vue'
import { ICON_BODIES, ICON_NAMES } from './icons'

const folder = resolve(__dirname, '../../../docs/design/system/assets/Icons')
const files = readdirSync(folder).filter((file) => file.endsWith('.svg'))
const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../../docs/design/system/tokens.json'), 'utf8')) as {
  color: { tokens: { name: string; value: { light: string } }[] }
}
const aiInk = tokens.color.tokens.find((token) => token.name === 'ai')!.value.light
const aiForms = ICON_NAMES.filter((name) => name.endsWith('-ai'))

describe('Icons v2', () => {
  it('names exactly the icons in the design system folder, so a missing or misspelled name fails', () => {
    expect([...ICON_NAMES].sort()).toEqual(files.map((file) => file.replace(/\.svg$/, '')).sort())
  })

  it('leaves the legacy row-progress icon out', () => {
    expect(ICON_NAMES).not.toContain('row-progress')
  })

  it.each(ICON_NAMES)('draws %s from its file, with no fixed color of its own', (name) => {
    const body = ICON_BODIES[name]
    expect(body.length).toBeGreaterThan(0)
    expect(readFileSync(resolve(folder, `${name}.svg`), 'utf8').replaceAll(` stroke="${aiInk}"`, '')).toContain(body)
    expect(body).not.toMatch(/#[0-9a-f]{3,6}/i)
  })

  it('has the AI forms of cut-out, tap-add and tap-remove (ticket 0764)', () => {
    expect(aiForms.sort()).toEqual(['cut-out-ai', 'tap-add-ai', 'tap-remove-ai'])
    for (const name of aiForms) expect(ICON_NAMES).toContain(name.replace(/-ai$/, ''))
  })

  it.each(aiForms)('draws the AI mark of %s as one part, in the light ai color as a file', (name) => {
    const file = readFileSync(resolve(folder, `${name}.svg`), 'utf8')
    expect(file.match(/class="ai-mark"/g)).toHaveLength(1)
    expect(file).toMatch(new RegExp(`<path class="ai-mark" stroke="${aiInk}"`))
    expect(ICON_BODIES[name]).toMatch(/<path class="ai-mark" d=/)
  })

  it('puts the AI mark on the AI forms only', () => {
    for (const name of ICON_NAMES.filter((icon) => !icon.endsWith('-ai'))) expect(ICON_BODIES[name], name).not.toContain('ai-mark')
  })
})

describe('AppIcon', () => {
  it('follows the text color with the icon rules: stroke 1.75, round caps and joins, no fill', () => {
    const svg = mount(AppIcon, { props: { name: 'paint' } }).get('svg')
    expect(svg.attributes()).toMatchObject({
      stroke: 'currentColor',
      'stroke-width': '1.75',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
      viewBox: '0 0 24 24',
    })
  })

  it('keeps the bead dots: zero-length round-cap strokes at their own width', () => {
    const svg = mount(AppIcon, { props: { name: 'bead' } }).get('svg')
    expect(svg.html()).toMatch(/h\.01/)
  })

  it('sizes itself in rem from the design system sizes', () => {
    const svg = mount(AppIcon, { props: { name: 'check', size: 14 } }).get('svg')
    expect(svg.attributes('style')).toContain('width: 0.875rem')
  })

  it('is hidden from assistive tech unless it is given a label', () => {
    expect(mount(AppIcon, { props: { name: 'info' } }).get('svg').attributes('aria-hidden')).toBe('true')

    const labelled = mount(AppIcon, { props: { name: 'warning', label: 'Warning' } }).get('svg')
    expect(labelled.attributes('aria-hidden')).toBeUndefined()
    expect(labelled.attributes('role')).toBe('img')
    expect(labelled.attributes('aria-label')).toBe('Warning')
  })
})

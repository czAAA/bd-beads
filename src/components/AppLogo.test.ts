import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppLogo from './AppLogo.vue'

const repo = resolve(__dirname, '../..')

describe('AppLogo', () => {
  it.each([
    [16, '4.2'],
    [22, '3.8'],
    [32, '3.6'],
    [48, '3.2'],
  ])('draws the mark at %ipx with a %s stroke, in the current color', (size, stroke) => {
    const svg = mount(AppLogo, { props: { size } }).get('svg')
    expect(svg.attributes('stroke-width')).toBe(stroke)
    expect(svg.attributes('stroke')).toBe('currentColor')
    expect(svg.attributes('style')).toContain(`width: ${size / 16}rem`)
  })

  it('draws the design system file, not a copy of it', () => {
    const file = readFileSync(resolve(repo, 'docs/design/system/assets/Logos/bd-beads-mark.svg'), 'utf8')
    const svg = mount(AppLogo).get('svg')
    expect(svg.findAll('circle')).toHaveLength(3)
    expect(svg.findAll('path')).toHaveLength(2)
    for (const path of svg.findAll('path')) expect(file).toContain(path.attributes('d'))
    expect(svg.html()).not.toMatch(/#fa520f/i)
  })

  it('is decorative unless it is given a name', () => {
    expect(mount(AppLogo).get('svg').attributes('aria-hidden')).toBe('true')
    const named = mount(AppLogo, { props: { label: 'bd-beads' } }).get('svg')
    expect(named.attributes('role')).toBe('img')
    expect(named.attributes('aria-label')).toBe('bd-beads')
  })
})

describe('the favicon set', () => {
  it('ships the design system files unchanged, linked from the page', () => {
    const html = readFileSync(resolve(repo, 'index.html'), 'utf8')
    for (const file of ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png']) {
      expect(readFileSync(resolve(repo, 'public', file))).toEqual(readFileSync(resolve(repo, 'docs/design/system/favicon', file)))
      expect(html).toContain(`href="/${file}"`)
    }
  })

  it('follows the browser: orange on light tab bars, yellow on dark ones', () => {
    const svg = readFileSync(resolve(repo, 'public/favicon.svg'), 'utf8')
    expect(svg).toContain('#fa520f')
    expect(svg).toMatch(/prefers-color-scheme: dark\)[^}]*#faff69/)
  })

  it('keeps the app icons ready for the PWA manifest (ticket 69)', () => {
    for (const file of ['bd-beads-app-icon.svg', 'bd-beads-app-icon-dark.svg']) {
      expect(existsSync(resolve(repo, 'public/icons', file))).toBe(true)
    }
  })
})

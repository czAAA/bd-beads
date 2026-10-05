import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The breakpoint setup ticket 167 lays down for every later responsive tier (168, 79): media queries can't read a
 * custom property, so `responsive.md`'s breakpoints are written into the CSS as literal numbers -- these tests read
 * them back out of `tokens.json` so a token change can't silently drift out of sync with what the shell actually says.
 */
const repo = resolve(__dirname, '..')
/** The app shell's layout CSS lives in its shell components (ticket 206): AppShell owns the body grid, AppSidebar the column. */
const appSource = ['AppShell', 'AppSidebar']
  .map((name) => readFileSync(resolve(__dirname, 'components/shell', `${name}.vue`), 'utf8'))
  .join('\n')
const tokens = JSON.parse(readFileSync(resolve(repo, 'docs/design/system/tokens.json'), 'utf8')) as {
  layout: { tokens: { name: string; value: string }[] }
}

function layoutPx(name: string): number {
  const token = tokens.layout.tokens.find((t) => t.name === name)
  if (!token) throw new Error(`no layout token named ${name}`)
  return parseInt(token.value, 10)
}

describe('the iPad 13" tier breakpoint (ticket 167; responsive.md, 1024-1279px)', () => {
  it('is written as the literal bp-tablet-lg / bp-laptop breakpoints', () => {
    const min = layoutPx('bp-tablet-lg')
    const maxExclusive = layoutPx('bp-laptop')
    expect(appSource).toContain(`@media (min-width: ${min}px) and (max-width: ${maxExclusive - 1}px)`)
  })

  it('docks the column at column-width-tablet-lg, with 16px page padding and a 12px gap between boxes', () => {
    expect(appSource).toContain('grid-template-columns: var(--column-width-tablet-lg) minmax(0, 1fr);')
    expect(appSource).toMatch(
      /@media \(min-width: 1024px\) and \(max-width: 1279px\) \{\s*\.app-shell__body \{[\s\S]{0,120}?padding: var\(--space-16\);/,
    )
    expect(appSource).toMatch(
      /@media \(min-width: 1024px\) and \(max-width: 1279px\) \{\s*\.app-shell__column \{[\s\S]{0,60}?gap: var\(--space-12\);/,
    )
  })

  it('leaves type and control sizes alone: the tier\'s own media queries touch only spacing and the column', () => {
    const blocks = [...appSource.matchAll(/@media \(min-width: 1024px\) and \(max-width: 1279px\) \{([\s\S]*?)\n\}\n/g)]
    expect(blocks.length).toBeGreaterThan(0)
    for (const [, body] of blocks) {
      expect(body).not.toMatch(/font:|font-size|height:|width:\s*(?!minmax)/)
    }
  })
})

describe('the 24" and larger tier (ticket 83; responsive.md, 1920px and up)', () => {
  const headerSource = readFileSync(resolve(__dirname, 'components/shell', 'AppHeader.vue'), 'utf8')
  const min = layoutPx('bp-desktop')

  it('is written as the literal bp-desktop breakpoint', () => {
    expect(min).toBe(1920)
    expect(appSource).toContain(`@media (min-width: ${min}px)`)
  })

  it('grows the column to column-width-desktop (360px) and the page padding to 32 / 40', () => {
    expect(layoutPx('column-width-desktop')).toBe(360)
    expect(appSource).toMatch(
      /@media \(min-width: 1920px\) \{\s*\.app-shell__body \{\s*grid-template-columns: var\(--column-width-desktop\) minmax\(0, 1fr\);\s*padding: var\(--space-32\) 2\.5rem;/,
    )
  })

  it('pads the header 0 40', () => {
    expect(headerSource).toMatch(/@media \(min-width: 1920px\) \{\s*\.app-header \{\s*padding-right: 2\.5rem;\s*padding-left: 2\.5rem;/)
  })

  it('leaves type and control sizes alone', () => {
    const blocks = [...appSource.matchAll(/@media \(min-width: 1920px\) \{([\s\S]*?)\n\}\n/g)]
    expect(blocks.length).toBeGreaterThan(0)
    for (const [, body] of blocks) expect(body).not.toMatch(/font:|font-size|height:|[^-]width:\s*(?!minmax)/)
  })

  it('leaves the MacBook Air tier (1280-1919px) on the reference column', () => {
    expect(appSource).toContain('grid-template-columns: var(--column-width) minmax(0, 1fr);')
    expect(layoutPx('column-width')).toBe(366)
  })
})

describe('everything under 1024px is the phone layout (ticket 295, ADR 0032)', () => {
  const shellDir = resolve(__dirname, 'components')
  const sources = ['shell/AppShell', 'shell/AppSidebar', 'shell/AppHeader', 'shell/AppBottomBar', 'tools/AppDock', 'canvas/CanvasPanel']
    .map((name) => readFileSync(resolve(shellDir, `${name}.vue`), 'utf8'))
    .join('\n')

  it('has no media query for the retired 744-1023px iPad mini tier, and no Drawer or BottomToolbar left', () => {
    expect(sources).not.toMatch(/min-width: 744px\) and \(max-width: 1023px/)
    expect(sources).not.toMatch(/max-width: 743px/)
    expect(existsSync(resolve(shellDir, 'shell/AppDrawer.vue'))).toBe(false)
    expect(existsSync(resolve(shellDir, 'shell/BottomToolbar.vue'))).toBe(false)
  })

  it('hides the header, the left column and the canvas header strip under 1024px', () => {
    const header = readFileSync(resolve(shellDir, 'shell/AppHeader.vue'), 'utf8')
    expect(header).toMatch(/@media \(max-width: 1023px\) \{\s*\.app-header \{\s*display: none;/)
    const sidebar = readFileSync(resolve(shellDir, 'shell/AppSidebar.vue'), 'utf8')
    expect(sidebar).toMatch(/@media \(max-width: 1023px\) \{\s*\.app-shell__column \{\s*display: none;/)
    const panel = readFileSync(resolve(shellDir, 'canvas/CanvasPanel.vue'), 'utf8')
    expect(panel).toMatch(/@media \(max-width: 1023px\) \{\s*\.app-shell__canvas-strip \{\s*display: none;/)
  })

  it('starts the canvas at the top edge, padded by the safe-area inset', () => {
    expect(appSource).toMatch(/@media \(max-width: 1023px\) \{\s*\.app-shell__body \{[^}]*padding: env\(safe-area-inset-top\)/)
  })

  it('makes the Dock 48px plus the safe-area inset, at most 480px wide, with one layout in both orientations', () => {
    expect(layoutPx('dock-height')).toBe(48)
    expect(layoutPx('dock-max-width')).toBe(480)
    const dock = readFileSync(resolve(shellDir, 'tools/AppDock.vue'), 'utf8')
    expect(dock).toContain('max-width: var(--dock-max-width);')
    expect(dock).toContain('padding-bottom: env(safe-area-inset-bottom);')
    expect(dock).not.toMatch(/max-height/)
  })
})

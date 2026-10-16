import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * One layout at every width (ticket 412, ADR 0046): the canvas box is the screen and the Tool pill floats over it (ticket 439). These tests read the shell's CSS back out of its
 * components, so a rule that brings a second, width-dependent layout back fails here, and read the sizes from
 * `tokens.json` so a token change can't silently drift out of sync with what the shell actually says.
 */
const repo = resolve(__dirname, '..')
const componentsDir = resolve(__dirname, 'components')
const source = (name: string) => readFileSync(resolve(componentsDir, `${name}.vue`), 'utf8')
const tokens = JSON.parse(readFileSync(resolve(repo, 'docs/design/system/tokens.json'), 'utf8')) as {
  layout: { tokens: { name: string; value: string }[] }
}

function layoutPx(name: string): number {
  const token = tokens.layout.tokens.find((t) => t.name === name)
  if (!token) throw new Error(`no layout token named ${name}`)
  return parseInt(token.value, 10)
}

describe('one layout at every width (ticket 412, ADR 0046)', () => {
  const shell = source('shell/AppShell')

  it('has no header, side column, Toolbox or Drawer left to mount', () => {
    for (const gone of ['shell/AppHeader', 'shell/AppSidebar', 'tools/Toolbox', 'tools/ToolGroup', 'ui/DisclosureRow', 'shell/AppDrawer', 'shell/BottomToolbar', 'shell/AppBottomBar', 'tools/AppDock']) {
      expect(existsSync(resolve(componentsDir, `${gone}.vue`)), gone).toBe(false)
    }
  })

  it('has no width-dependent rule in the shell, the canvas panel or the bars', () => {
    for (const name of ['shell/AppShell', 'canvas/CanvasPanel', 'tools/ToolPill']) {
      expect(source(name), name).not.toMatch(/@media \((?:min|max)-width/)
    }
  })

  it('puts the canvas box screen-edge (6px) from every screen edge, the safe-area inset winning where larger', () => {
    expect(layoutPx('screen-edge')).toBe(6)
    const rule = shell.match(/\.app-shell__body \{[^}]*\}/)?.[0] ?? ''
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(rule).toContain(`max(var(--screen-edge), env(safe-area-inset-${side}))`)
    }
    expect(shell).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(shell).not.toContain('AppBottomBar')
  })

  it('sizes the Tool pill from the tokens: 48px across, pill-gap in, on the canvas overlay layer, scrolling along its length', () => {
    expect(layoutPx('pill-thickness')).toBe(48)
    expect(layoutPx('pill-gap')).toBe(6)
    const pill = source('tools/ToolPill')
    expect(pill).toContain('z-index: var(--z-canvas-overlay);')
    expect(pill).toContain('bottom: var(--pill-gap);')
    expect(pill).toContain('max-width: calc(100% - 2 * var(--pill-gap));')
    expect(pill).toMatch(/overflow: auto;\s*scrollbar-width: none;/)
  })
})

describe('the page never scrolls under the app shell (ticket 320)', () => {
  const base = readFileSync(resolve(__dirname, 'style.css'), 'utf8')

  it('locks the document to the viewport whenever the shell is mounted', () => {
    const rule = base.match(/html:has\(\.app-shell\),\s*html:has\(\.app-shell\) body\s*\{([^}]*)\}/)
    expect(rule?.[1]).toMatch(/overflow:\s*hidden/)
    expect(rule?.[1]).toMatch(/height:\s*100%/)
  })

  it('leaves the shell scrolling nothing itself', () => {
    expect(source('shell/AppShell')).toMatch(/\.app-shell\s*\{[^}]*overflow:\s*hidden/)
  })
})

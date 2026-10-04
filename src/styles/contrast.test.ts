import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * contrast.css (ticket 160) reaches into components by their class names, so a renamed class would quietly drop out of
 * high contrast or forced colors. Every class it names has to still be a class some component draws.
 */
const here = __dirname
const sheet = readFileSync(join(here, 'contrast.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function vueSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? vueSources(join(dir, entry.name)) : entry.name.endsWith('.vue') ? [readFileSync(join(dir, entry.name), 'utf8')] : [],
  )
}

const templates = vueSources(join(here, '..')).map((source) => source.split('<style')[0]).join('\n')

describe('contrast.css', () => {
  const classes = [...new Set([...sheet.matchAll(/\.([a-z][a-z0-9_-]*)/g)].map((match) => match[1]!))]

  it('names classes at all', () => {
    expect(classes.length).toBeGreaterThan(20)
  })

  it.each(classes)('.%s is still a class a component draws', (name) => {
    expect(templates).toMatch(new RegExp(`['"\\s\`{]${name}(?![a-z0-9_-])`))
  })

  it('keeps every bead color in forced colors: the Project, the swatches and the thumbnails', () => {
    const forced = sheet.slice(sheet.indexOf('@media (forced-colors: active)'))
    const keep = forced.slice(0, forced.indexOf('forced-color-adjust: none'))
    for (const name of ['project-surface', 'palette-picker__swatch', 'bead-quantities__swatch', 'project-thumbnail', 'qr-code']) {
      expect(keep).toContain(`.${name}`)
    }
  })
})

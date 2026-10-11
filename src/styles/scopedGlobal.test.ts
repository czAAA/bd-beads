import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compileStyle } from 'vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

const src = resolve(__dirname, '..')

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name)
    return entry.isDirectory() ? vueFiles(path) : path.endsWith('.vue') ? [path] : []
  })
}

function compiled(source: string): string {
  return compileStyle({ source, id: 'data-v-x', scoped: true, filename: 'x.vue' }).code.replace(/\s+/g, ' ').trim()
}

/** The `:global(...)` calls in `text` that are followed by more selector, with the line each starts on. */
function globalsWithTail(text: string): string[] {
  const found: string[] = []
  for (let at = text.indexOf(':global('); at !== -1; at = text.indexOf(':global(', at + 1)) {
    let depth = 0
    let end = at + ':global'.length
    for (; end < text.length; end += 1) {
      if (text[end] === '(') depth += 1
      if (text[end] === ')' && --depth === 0) break
    }
    // Only a rule's own `{` or the next selector of a list may follow; anything else is a tail Vue will drop.
    if (!/^\s*[{,]/.test(text.slice(end + 1))) found.push(text.slice(at, end + 1))
  }
  return found
}

describe(':global() in scoped styles', () => {
  // A descendant after `:global(...)` is not an error, it is dropped, and the rule lands on the ancestor itself.
  // The Dock layout shipped that way and moved the whole shell off screen on an iPad (ticket 383).
  it('drops whatever follows it, so the whole selector has to be inside the parentheses', () => {
    expect(compiled(':global(.a) .b { x: 1 }')).toBe('.a { x: 1 }')
    expect(compiled(':global(.a:not(.b)) .c { x: 1 }')).toBe('.a:not(.b) { x: 1 }')
    expect(compiled(':global(.a .b) { x: 1 }')).toBe('.a .b { x: 1 }')
  })

  it('finds a tail after nested parentheses and across lines', () => {
    expect(globalsWithTail(':global(.a:not(.b))\n  .c {')).toEqual([':global(.a:not(.b))'])
    expect(globalsWithTail(':global(.a .b:not(.c)) {')).toEqual([])
    expect(globalsWithTail(':global(.a), :global(.b) {')).toEqual([])
  })

  it('is never followed by more selector in the app', () => {
    const offenders = vueFiles(src).flatMap((file) =>
      globalsWithTail(readFileSync(file, 'utf8')).map((call) => `${file.slice(src.length + 1)}: ${call}`),
    )
    expect(offenders).toEqual([])
  })
})

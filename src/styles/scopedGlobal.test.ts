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

const compiled = (source: string) => compileStyle({ source, id: 'data-v-x', scoped: true, filename: 'x.vue' }).code.replace(/\s+/g, ' ').trim()

describe(':global() in scoped styles', () => {
  // Why the rule below exists: a descendant after `:global(...)` is not an error, it is dropped, and the rule lands on the
  // ancestor itself. The Dock layout shipped that way and moved the whole shell off screen on an iPad (ticket 383).
  it('drops whatever follows it, so the whole selector has to be inside the parentheses', () => {
    expect(compiled(':global(.a) .b { x: 1 }')).toBe('.a { x: 1 }')
    expect(compiled(':global(.a .b) { x: 1 }')).toBe('.a .b { x: 1 }')
  })

  it('is never followed by more selector in the app', () => {
    const offenders = vueFiles(src).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => /:global\([^)]*\)\s*[.:[#>+~a-zA-Z]/.test(line))
        .map((line) => `${file.slice(src.length + 1)}: ${line.trim()}`),
    )
    expect(offenders).toEqual([])
  })
})

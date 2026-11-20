import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Every stylesheet and component under `dir`, for the tests that hold a rule over all of the app's styles. */
export function styleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name)
    return entry.isDirectory() ? styleFiles(path) : /\.(vue|css)$/.test(entry.name) ? [path] : []
  })
}

/** A file's CSS without comments: a `.vue` file's style blocks, a `.css` file whole. */
export function stylesOf(path: string): string {
  const text = readFileSync(path, 'utf8')
  const css = path.endsWith('.vue') ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, block]) => block).join('\n') : text
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

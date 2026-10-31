import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

/** What the hover text check reads from the source (ticket 264): where Tooltips are made, plus the guards keeping
 * hover text shared. */

const SRC = join(import.meta.dirname, '..')

export interface SourceFile {
  /** Path from src/, e.g. components/ui/ProgressBar.vue. */
  path: string
  /** The component's name as Vue reports it (the file's name). */
  name: string
  template: string
  /** The components it draws through `<component :is>`: every one its script imports (the Homepage's sections, ticket 0744). */
  drawsByName?: string[]
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))
}

/** Every component's template, without its script and style. */
export function sourceFiles(): SourceFile[] {
  return walk(SRC)
    .filter((file) => file.endsWith('.vue'))
    .map((file) => {
      const text = readFileSync(file, 'utf8')
      const start = text.indexOf('<template>')
      const end = text.lastIndexOf('</template>')
      const template = start >= 0 && end > start ? text.slice(start, end) : ''
      const drawsByName = /<component\b/.test(template) ? [...text.matchAll(/import\s+(\w+)\s+from\s+'[^']*\.vue'/g)].map((match) => match[1]!) : undefined
      return { path: relative(SRC, file), name: basename(file, '.vue'), template, drawsByName }
    })
}

interface Tag {
  name: string
  attributes: Record<string, string>
}

const TAG = /<([A-Za-z][\w.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g
const ATTRIBUTE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

export function tags(template: string): Tag[] {
  return [...template.matchAll(TAG)].map((match) => {
    const attributes: Record<string, string> = {}
    for (const attribute of (match[2] ?? '').matchAll(ATTRIBUTE)) attributes[attribute[1]!] = attribute[2] ?? attribute[3] ?? attribute[4] ?? ''
    return { name: match[1]!, attributes }
  })
}

/** Components that are only a Tooltip around a button, so that using one is making a Tooltip. */
export const TOOLTIP_MAKERS = ['AppTooltip', 'IconButton']

/** Components that hand their attributes (a `title`) on to the native element inside. */
const PASS_THROUGH = ['AppButton', 'IconButton']

/** Every place a native `title` is used, which the browser shows as hover text that nothing can clip, measure or
 * style. */
export function nativeTitles(): { file: string; what: string }[] {
  const found: { file: string; what: string }[] = []
  for (const file of sourceFiles()) {
    for (const tag of tags(file.template)) {
      const native = /^[a-z]/.test(tag.name) || PASS_THROUGH.includes(tag.name)
      const value = tag.attributes['title'] ?? tag.attributes[':title']
      if (!native || value === undefined) continue
      // What names the text: the translation it reads, or the attribute as written.
      found.push({ file: file.path, what: value.match(/\bt\.[\w.]+/)?.[0] ?? value })
    }
  }
  return found
}

/** The hand-made hover texts, which open by click or focus rather than by hover (ticket 229 measures them too). */
export interface InfoPopover {
  file: string
  testid: string
}

/** Hand-made tooltips in templates: a `role="tooltip"` or a tooltip class outside the shared Tooltip. */
export function handMadeTooltips(): { file: string; testid: string }[] {
  const found: { file: string; testid: string }[] = []
  for (const file of sourceFiles()) {
    if (file.name === 'AppTooltip') continue
    for (const tag of tags(file.template)) {
      const classes = `${tag.attributes['class'] ?? ''} ${tag.attributes[':class'] ?? ''}`
      if (tag.attributes['role'] === 'tooltip' || /tooltip/i.test(classes)) found.push({ file: file.path, testid: tag.attributes['data-testid'] ?? `(${tag.name} ${classes.trim()})` })
    }
  }
  return found
}

/** The components that make Tooltips: the files whose templates use the shared Tooltip or a button that has one. */
export function tooltipMakers(): string[] {
  return sourceFiles()
    .filter((file) => tags(file.template).some((tag) => TOOLTIP_MAKERS.includes(tag.name)))
    .map((file) => file.name)
}

/** The components the browser fit tests reach: those a `*.browser.test.ts` imports (it mounts them), and every
 * component used in the template of one already reached (it is on the page whenever that one is). */
export function exercisedComponents(): Set<string> {
  const files = sourceFiles()
  const byName = new Map(files.map((file) => [file.name, file]))
  const reached = new Set<string>()
  const queue: string[] = []
  const reach = (name: string) => {
    if (byName.has(name) && !reached.has(name)) {
      reached.add(name)
      queue.push(name)
    }
  }
  for (const test of walk(SRC).filter((file) => file.endsWith('.browser.test.ts'))) {
    for (const match of readFileSync(test, 'utf8').matchAll(/import\s+(\w+)\s+from\s+'[^']*\.vue'/g)) reach(match[1]!)
  }
  while (queue.length > 0) {
    const file = byName.get(queue.pop()!)!
    for (const tag of tags(file.template)) reach(tag.name)
    for (const name of file.drawsByName ?? []) reach(name)
  }
  return reached
}

/** The components whose template shows a translated text: the ones a text fit test is for. */
export function componentsWithText(): SourceFile[] {
  return sourceFiles().filter((file) => /\bt\.[a-zA-Z]/.test(file.template))
}

/** The source files (not tests) that read a top-level group of the translations, `t.<group>` or `.<group>.`. */
export function filesReadingTranslations(group: string): SourceFile[] {
  const pattern = new RegExp(`(?:\\bt\\b|\\bt\\.value)\\.${group}\\b|\\.${group}\\.`)
  return walk(SRC)
    .filter((file) => /\.(vue|ts)$/.test(file) && !file.endsWith('.test.ts') && !/[\\/](i18n|testUtils)[\\/]/.test(file))
    .map((file) => ({ path: relative(SRC, file), name: basename(file).replace(/\.(vue|ts)$/, ''), template: readFileSync(file, 'utf8') }))
    .filter((file) => pattern.test(file.template))
}

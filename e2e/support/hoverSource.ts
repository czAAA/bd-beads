import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

/**
 * What the hover text check reads out of the app's source (ticket 264): where Tooltips are made, and the two guards
 * that keep hover text going through the shared Tooltip, so that every one of them is found and measured. Plain text
 * scanning of the .vue templates, cheap on purpose.
 */

const SRC = join(import.meta.dirname, '..', '..', 'src')

export interface SourceFile {
  /** Path from src/, e.g. components/ui/ProgressBar.vue. */
  path: string
  /** The component's name as Vue reports it (the file's name). */
  name: string
  template: string
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
      return { path: relative(SRC, file), name: basename(file, '.vue'), template: start >= 0 && end > start ? text.slice(start, end) : '' }
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
export const TOOLTIP_MAKERS = ['AppTooltip', 'IconButton', 'ToolButton']

/** Components that hand their attributes (a `title`) on to the native element inside. */
const PASS_THROUGH = ['AppLink', 'AppButton', 'IconButton', 'ToolButton']

/** Every place a native `title` is used, which the browser shows as hover text that nothing can clip, measure or style. */
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

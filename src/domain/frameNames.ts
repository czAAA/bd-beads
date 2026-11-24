import { fillBlanks } from './fillBlanks'

/** The name a Frame gets when it has none (spec 1214): the words "Frame {n}" with the lowest number no Frame goes by. A
 * name that does not read as this one's (another language, a name the maker typed) uses no number, and two Frames may share
 * a name, so only the ones that read as this one's count. */
export function nextFrameName(template: string, taken: readonly (string | undefined)[]): string {
  const [before, after] = template.split('{n}') as [string, string]
  const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reads = new RegExp(`^${escaped(before)}(\\d+)${escaped(after)}$`)
  const used = new Set(taken.map((name) => Number(reads.exec(name ?? '')?.[1] ?? NaN)))
  let n = 1
  while (used.has(n)) n += 1
  return fillBlanks(template, { n })
}

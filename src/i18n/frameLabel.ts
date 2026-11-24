import { fillBlanks } from '../domain/fillBlanks'
import type { Translations } from './translations'

/** What a Frame is called in a list or a message (spec 1214): its name, or for one that has none (a Project saved before
 * every Frame had a name) the default its place in the list gives it, "Frame 2", or plain "Frame" where the place is unknown. */
export function frameLabel(t: Translations, frame: { name?: string }, index?: number): string {
  if (frame.name) return frame.name
  return index === undefined ? t.frame.title : fillBlanks(t.frame.defaultName, { n: index + 1 })
}

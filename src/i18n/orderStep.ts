import { fillBlanks } from '../domain/fillBlanks'
import type { OrderStep } from '../domain/rowOrder'
import type { Translations } from './translations'

/** A Custom frame's pass in words (ticket 0594): "Round 3", "Part 2, round 3", "Strand 4" (ticket 0597), "Zip 1–2", for
 * the Progress bar and the Word chart. */
export function orderStepLabel(words: Translations['rowProgress'], step: OrderStep): string {
  if (step.kind === 'join') {
    const template = { zip: words.stepZip, hinge: words.stepHinge, close: words.stepClose }[step.step]
    return fillBlanks(template, { parts: step.parts.join('–') })
  }
  if (step.kind === 'strand') return fillBlanks(words.stepStrand, { number: step.number })
  if (step.part !== undefined) return fillBlanks(words.stepPartRound, { part: step.part, number: step.number })
  return fillBlanks(step.kind === 'round' ? words.stepRound : words.stepRow, { number: step.number })
}

import type { Technique } from './grid'

/** Row progress counts passes, not lines (ticket 347); a line is a row or column of the Frame. Loom and brick stitch:
 * one pass per line. Peyote: the first line one pass, every later line two (even positions first, then odd). */

/** How many passes weaving `lines` lines takes. */
export function passCount(technique: Technique, lines: number): number {
  if (technique !== 'peyote' || lines <= 0) {
    return Math.max(0, lines)
  }
  return 1 + (lines - 1) * 2
}

/** The pass (zero-based) that weaves the bead at `along` (its position along its line) in line `line`; both counted
 * from the Frame's first. */
export function passOf(technique: Technique, line: number, along: number): number {
  if (technique !== 'peyote' || line === 0) {
    return line
  }
  return (line - 1) * 2 + 1 + (along % 2)
}

/** The line a pass works on: what the rulers number and what the current-line marker sits on. */
export function lineOfPass(technique: Technique, pass: number): number {
  return technique === 'peyote' && pass > 0 ? Math.ceil(pass / 2) : pass
}

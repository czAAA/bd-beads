// The rolling slogan's words (ticket 550; Homepage card), in the order they appear; the one pass closes on the first.
// The line is the brand, not copy: the same in every language.
export const SLOGAN_WORDS = [
  'beads',
  'draw',
  'joy',
  'weave',
  'create',
  'art',
  'canvas',
  'possibility',
  'play',
  'wonder',
  'pattern',
  'ideas',
] as const

/** `--slogan-hold` and `--slogan-roll` (design-values.css), in ms: "openbeads" before the one pass, then the pass,
 * under the 5 s that WCAG 2.2.2 lets motion run with no pause (ticket 0925). */
export const SLOGAN_HOLD_MS = 1200
export const SLOGAN_ROLL_MS = 3600

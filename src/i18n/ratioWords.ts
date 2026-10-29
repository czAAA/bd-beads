import type { PixelToBeadRatio } from '../domain/convertSize'
import { fillBlanks } from '../domain/fillBlanks'
import type { Translations } from './translations'

/** A Pixel to bead ratio as its chip writes it, picture pixels first: "2:1", "1:4". */
export function ratioText(ratio: PixelToBeadRatio): string {
  return `${ratio.pixels}:${ratio.beads}`
}

/** What a Pixel to bead ratio does, in one sentence: the PixelToBeadRatio card's explainer and its chip's Tooltip
 * (ticket 0650). */
export function ratioSentence(t: Translations, ratio: PixelToBeadRatio): string {
  const words = t.convertImage.wizard
  if (ratio.beads > 1) return fillBlanks(words.everyPixelBeads, { n: ratio.beads })
  return ratio.pixels > 1 ? fillBlanks(words.everyBlock, { n: ratio.pixels }) : words.everyPixel
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { openSync, type Font } from 'fontkit'

/** How wide a text is set in the app's own fonts (ticket 552): the faces and their unicode ranges are read from
 * `src/styles/fonts.css` and the files from `public/fonts/`, so this cannot drift from what the page loads. No page. */

const ROOT = join(import.meta.dirname, '..', '..')
const FACE = /@font-face\s*{([^}]*)}/g
const UNICODE_RANGE = /unicode-range:\s*([^;]+);/

interface Face {
  family: string
  weight: number
  italic: boolean
  ranges: [number, number][]
  file: string
}

let faces: Face[] | undefined
const fonts = new Map<string, Font>()

function parseRanges(text: string): [number, number][] {
  return text.split(',').map((range) => {
    const [from, to] = range.trim().replace('U+', '').split('-')
    return [parseInt(from!, 16), parseInt(to ?? from!, 16)]
  })
}

function loadFaces(): Face[] {
  if (faces) return faces
  const css = readFileSync(join(ROOT, 'src', 'styles', 'fonts.css'), 'utf8')
  faces = [...css.matchAll(FACE)].map((match) => {
    const body = match[1]!
    return {
      family: body.match(/font-family:\s*'([^']+)'/)![1]!,
      weight: Number(body.match(/font-weight:\s*(\d+)/)![1]),
      italic: /font-style:\s*italic/.test(body),
      ranges: parseRanges(body.match(UNICODE_RANGE)![1]!),
      file: body.match(/url\('\/fonts\/([^']+)'\)/)![1]!,
    }
  })
  return faces
}

function fontOf(face: Face): Font {
  let font = fonts.get(face.file)
  if (!font) {
    font = openSync(join(ROOT, 'public', 'fonts', face.file)) as Font
    fonts.set(face.file, font)
  }
  return font
}

/** The Chinese, Japanese and Korean blocks and the full-width forms: the app bundles no font for them (the system's
 * is used, DESIGN.md §4.4), so each counts as one em, which is what those fonts set them at. */
const FULL_WIDTH = [[0x2e80, 0x9fff], [0xac00, 0xd7af], [0xff00, 0xffef], [0x3000, 0x303f]]

/** What any other glyph the fonts lack is counted at, in em: a typical Latin letter's average. */
const UNKNOWN_GLYPH_EM = 0.55

export interface TextWidth {
  /** In CSS pixels. */
  width: number
  /** True when some of the text is set in a font the app does not bundle, so the width is an estimate. */
  estimated: boolean
}

/** The width of `text` on one line in `family` ('Inter' for the UI) at `size` px and `weight`, kerning included. */
export function textWidth(text: string, { size, weight, family = 'Inter', italic = false }: { size: number; weight: number; family?: string; italic?: boolean }): TextWidth {
  const candidates = loadFaces().filter((face) => face.family === family && face.italic === italic)
  const weights = [...new Set(candidates.map((face) => face.weight))]
  const nearest = weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0]!)
  let width = 0
  let estimated = false
  let run: { face: Face; text: string } | undefined
  const flush = () => {
    if (!run) return
    const font = fontOf(run.face)
    width += (font.layout(run.text).advanceWidth / font.unitsPerEm) * size
    run = undefined
  }
  for (const char of text) {
    const code = char.codePointAt(0)!
    const face = candidates.find((candidate) => candidate.weight === nearest && candidate.ranges.some(([from, to]) => code >= from && code <= to))
    if (face && fontOf(face).hasGlyphForCodePoint(code)) {
      if (run?.face !== face) {
        flush()
        run = { face, text: '' }
      }
      run!.text += char
      continue
    }
    flush()
    estimated = true
    width += FULL_WIDTH.some(([from, to]) => code >= from! && code <= to!) ? size : size * UNKNOWN_GLYPH_EM
  }
  flush()
  return { width, estimated }
}

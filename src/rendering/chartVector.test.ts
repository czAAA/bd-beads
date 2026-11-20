import { describe, expect, it } from 'vitest'
import { changeFrame } from '../domain/changeFrame'
import { rotateFrame } from '../domain/rotate'
import { FRAME_SHAPE_IDS, type FrameShapeId, frameLayoutOf } from '../domain/frameShape'
import { onLayer } from '../domain/layers'
import { createProject } from '../domain/createProject'
import { paintCells } from '../domain/drawing'
import type { Project } from '../domain/project'
import { TECHNIQUES, type Technique } from '../domain/weave'
import { chartLookOf, drawChartParts, K, letterColor, letterPt, mmPt, placeBeads, rulerNumberPt } from './chartVector'
import { HELVETICA_CAP_HEIGHT, helveticaWidth } from '../domain/helvetica'
import { type PageDrawing, type Paint, PdfContent, type TextStyle } from '../domain/pdfContent'
import { PRINT_COLORS } from './printColors'
import { planWithKey } from './chartPageKey'
import { acrossNumber, EMPTY_CROSS_SHARE } from './printPages'
import { chartOnPageOne, displayedGrid, partLetter, planPrint, mm, PRINT_RULER, type PrintPlan } from './printPlan'
import { customChart } from './customChart'
import { pageOneLayout } from './pageOneLayout'
import { displayedExtentPx } from './surfaceView'
import { frameWeave } from '../domain/layerWeave'
import { projectDimensions } from '../domain/projectExtent'
import { wordChartOf } from '../domain/wordChart'
import { frameOf, quarterTurnOf, withFrameSheet } from '../domain/layerRecord'
import { type LayersChange, withLayers } from '../testUtils/layerFields'

// The PrintChartPage card's Acceptance list, on a 100 × 100 loom Schema with an empty background, White beads and dark
// beads, Letters off.
const DARK = '#1f2a44'
const LETTERS = { '#ffffff': 'A', [DARK]: 'B', '#f2c94c': 'AA' }

function schema(technique: Technique = 'loom', columns = 100, rows = 100, extra: LayersChange = {}): Project {
  const base = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  // Dark in the top left 10 × 10, White in the next 5 columns of its first 10 rows, a pale yellow beyond them; the rest empty.
  const beads: Record<number, Record<number, string>> = {}
  for (let row = 0; row < 10; row += 1) {
    beads[row] = {}
    for (let column = 0; column < 10; column += 1) beads[row]![column] = DARK
    for (let column = 10; column < 15; column += 1) beads[row]![column] = '#ffffff'
    beads[row]![15] = '#f2c94c'
  }
  return withLayers(base, { frame: { ...frameOf(base)!, beads }, paletteLetters: LETTERS, letters: false, ...extra })
}

/** The arms of the empty positions' crosses: the bare line segments stroked faint at 0.1 mm, as [x1, y1, x2, y2] in
 * points. The stroke's colour and width are only written when they change, so they are followed through the content. */
function crossArms(content: string): number[][] {
  let color = ''
  let width = ''
  const arms: number[][] = []
  for (const line of content.split('\n')) {
    if (line.endsWith(' RG')) color = line
    else if (line.endsWith(' w')) width = line
    else if (color === '0.659 0.659 0.659 RG' && width === '0.283 w' && /^([\d.-]+ [\d.-]+ m [\d.-]+ [\d.-]+ l ?)+$/.test(line)) {
      arms.push(...[...line.matchAll(/([\d.-]+) ([\d.-]+) m ([\d.-]+) ([\d.-]+) l/g)].map((match) => match.slice(1, 5).map(Number)))
    }
  }
  return arms
}

const texts = (content: string) => [...content.matchAll(/BT \/(F[12]) ([\d.]+) Tf ([\d.]+) Tz ([\d.-]+) ([\d.-]+) Td \(([^)]*)\) Tj ET/g)].map((match) => ({ font: match[1]!, size: Number(match[2]), scale: Number(match[3]), x: Number(match[4]), y: Number(match[5]), value: match[6]! }))

/** A Schema of `columns` × `rows` with every position painted. */
function full(technique: Technique, beadId: string, columns: number, rows: number, orientation: number, techniqueSettings?: Record<string, number>): Project {
  const base = createProject({ technique, beadId, ...(techniqueSettings ? { techniqueSettings } : {}), size: { width: columns, height: rows, unit: 'beads' } })
  const { columns: wide, rows: tall } = frameOf(base)!
  const beads = Object.fromEntries(Array.from({ length: tall }, (_, row) => [row, Object.fromEntries(Array.from({ length: wide }, (_, column) => [column, DARK]))]))
  return withLayers(base, { frame: { ...frameOf(base)!, beads }, orientation, paletteLetters: LETTERS, letters: false })
}

/** The ruler numbers the parts are drawn with: each text that is only digits, with its style and place in points. */
function rulerTexts(project: Project, plan: PrintPlan, parts: PrintPlan['parts']) {
  const found: { value: string; x: number; baseline: number; style: TextStyle; align?: string }[] = []
  const recorder: PageDrawing = {
    fillRect: () => {},
    lines: () => {},
    roundRect: () => {},
    polygon: () => {},
    text: (value, x, baseline, style, align) => {
      if (/^\d+$/.test(value)) found.push({ value, x, baseline, style, ...(align ? { align } : {}) })
    },
  }
  drawChartParts(recorder, project, plan, parts, LETTERS)
  return found
}

/** Empty grid and Chart border both on (ticket 1127): the empty positions' outline and cross, and the rim. */
const EMPTY_GRID_ON = { rim: true, emptyGrid: true }

/** The parts drawn as PDF operators. */
function pdfOf(project: Project, plan: ReturnType<typeof planPrint>, parts: ReturnType<typeof planPrint>['parts'], letters: Record<string, string>, height = plan.page.height, look?: { rim: boolean; emptyGrid: boolean }) {
  const content = new PdfContent(height * K)
  return { content, pads: drawChartParts(content, project, plan, parts, letters, undefined, look) }
}

function chartOf(project: Project, part = 0, look?: { rim: boolean; emptyGrid: boolean }) {
  const plan = planPrint(project, { keyRows: 2 })
  const parts = [plan.parts[part]!]
  return { plan, part: parts[0]!, ...pdfOf(project, plan, parts, LETTERS, plan.page.height, look) }
}

describe('a chart page is drawn as lines and letters (ticket 0585, ADR 0043)', () => {
  it('draws no picture, and sets its letters in the built-in Helvetica faces', () => {
    const { content } = chartOf(schema())
    const pdf = content.toString()

    expect(pdf).not.toContain(' Do')
    expect(texts(pdf).every((text) => text.font === 'F1' || text.font === 'F2')).toBe(true)
  })

  it('puts the whole 100 × 100 on one part at 1.8 mm, the pad at 10 mm from the left and 25 mm from the top (ticket 0913)', () => {
    const { part, pads, plan } = chartOf(schema())

    expect(plan.parts).toHaveLength(1)
    expect([part.lastAcross - part.firstAcross + 1, part.lastDown - part.firstDown + 1]).toEqual([100, 100])
    expect(pads[0]!.x / mm(1)).toBeCloseTo(10, 5)
    expect(pads[0]!.y / mm(1)).toBeCloseTo(25, 5)
    expect(plan.zoom * 20 / mm(1)).toBeCloseTo(1.8, 2)
    expect(plan.beadMm).toBeCloseTo(1.8, 2)
  })

  it('letters every bead, Letters off or on, and no empty position', () => {
    const project = schema()
    const { content, part } = chartOf(project)
    const letters = texts(content.toString()).filter((text) => text.font === 'F2' && /^[A-Z]+$/.test(text.value))
    const painted = 10 * 16 // the 16 columns painted in each of 10 rows, all inside part A

    expect(part.firstAcross).toBe(0)
    expect(letters).toHaveLength(painted)
    expect(new Set(letters.map((text) => text.value))).toEqual(new Set(['A', 'B', 'AA']))
    expect(texts(pdfOf(withLayers(project, { letters: true }), planPrint(project, { keyRows: 2 }), [part], LETTERS, 1754).content.toString()).filter((text) => /^[A-Z]+$/.test(text.value))).toHaveLength(painted)
  })

  it('scales the Swatch letter with the bead: 6.5 pt at 3 mm, about 4.3 pt at 1.8 mm, larger above 3 mm (ticket 0913)', () => {
    expect(letterPt(3)).toBeCloseTo(6.5, 5)
    expect(letterPt(1.8)).toBeGreaterThan(4.2)
    expect(letterPt(1.8)).toBeLessThan(4.35)
    expect(letterPt(9)).toBeGreaterThan(letterPt(3) * 2.9)
  })

  it('keeps a two-letter Swatch letter inside its cell, setting a wide one smaller', () => {
    const wide = { [DARK]: 'WM', '#ffffff': 'A', '#f2c94c': 'AA' }
    const plan = planPrint(schema(), { keyRows: 2 })
    const pdf = pdfOf(schema(), plan, plan.parts, wide).content.toString()
    const cell = plan.beadMm * (72 / 25.4)
    const marks = texts(pdf).filter((text) => text.value.length === 2 && /^[A-Z]+$/.test(text.value))

    expect(new Set(marks.map((text) => text.value))).toEqual(new Set(['WM', 'AA']))
    expect(marks.every((text) => (helveticaWidth(text.value, 'bold', text.size) * text.scale) / 100 <= cell)).toBe(true)
    expect(marks.find((text) => text.value === 'WM')!.size).toBeLessThan(marks.find((text) => text.value === 'AA')!.size)
  })

  it('sets a letter on a 3 mm bead in 6.5 pt, centred across its bead, with its baseline 2.32 mm below the top of the cell', () => {
    const { content, plan } = chartOf(schema('loom', 60, 75))
    const first = texts(content.toString()).find((text) => text.value === 'B')!
    const pointsPerMm = 72 / 25.4

    expect(plan.beadMm).toBeCloseTo(3, 2)
    expect(first.size).toBeCloseTo(6.5, 2)
    // Helvetica-Bold B is 722/1000 em wide; the first cell starts at 10 mm + 5 mm of ruler and is 3 mm wide.
    expect(first.x).toBeCloseTo((15 + 1.5) * pointsPerMm - (0.722 * 6.5) / 2, 1)
    expect(first.y).toBeCloseTo(plan842() - (30 + 2.32) * pointsPerMm + 0.0, 0)
  })

  it('squeezes a two-letter Swatch letter to 72 % across', () => {
    const { content } = chartOf(schema())
    const two = texts(content.toString()).filter((text) => text.value === 'AA')

    expect(two.length).toBeGreaterThan(0)
    expect(two.every((text) => text.scale === 72)).toBe(true)
    expect(texts(content.toString()).find((text) => text.value === 'B')!.scale).toBe(100)
  })

  it('draws a white letter on a dark bead and an ink letter on a light one and on White', () => {
    expect([letterColor(DARK), letterColor('#ffffff'), letterColor('#f2c94c'), letterColor('#000000')]).toEqual(['#ffffff', '#1f1f1f', '#1f1f1f', '#ffffff'])
  })

  it('switches a letter from white to ink where a Swatch mark switches, and writes ink on a color it cannot read', () => {
    expect([letterColor('#757575'), letterColor('#767676')]).toEqual(['#ffffff', '#1f1f1f'])
    expect(letterColor('red')).toBe('#1f1f1f')
  })

  it('fills only the painted positions: an empty position has no fill', () => {
    const { content } = chartOf(schema())
    const fills = content.toString().match(/ re f/g) ?? []

    expect(fills).toHaveLength(10 * 16)
  })

  it('marks every empty position, and only those, with a small faint cross, 0.1 mm, with Empty grid on (tickets 0818, 1127)', () => {
    const { part, content } = chartOf(schema(), 0, EMPTY_GRID_ON)
    const crosses = crossArms(content.toString())
    const positions = (part.lastAcross - part.firstAcross + 1) * (part.lastDown - part.firstDown + 1)

    expect(crosses).toHaveLength((positions - 10 * 16) * 2)
  })

  it('marks an empty position among round beads with the same cross, 40 % of the bead across, with Empty grid on (ticket 0818)', () => {
    const base = createProject({ technique: 'loom', beadId: 'toho/round/8-0', size: { width: 4, height: 4, unit: 'beads' } })
    const project = withLayers(base, { frame: { ...frameOf(base)!, beads: { 0: { 0: DARK } } }, paletteLetters: LETTERS, letters: false })
    const { plan, part, content } = chartOf(project, 0, EMPTY_GRID_ON)
    const arms = crossArms(content.toString())
    const empty = placeBeads(project, plan, part).filter((bead) => bead.color === null)

    expect(empty.length).toBeGreaterThan(0)
    expect(arms).toHaveLength(empty.length * 2)
    const across = Math.abs(arms[0]![2] - arms[0]![0])
    expect(across / (plan.zoom * displayedGrid(project).stepAcross * K)).toBeCloseTo(EMPTY_CROSS_SHARE, 2)
  })

  it('numbers every row and column, upright, on all four sides, in Helvetica regular (ticket 1129)', () => {
    const { content } = chartOf(schema('loom', 150, 100))
    const numbers = texts(content.toString()).filter((text) => /^\d+$/.test(text.value))

    // Part A's 75 columns on each of the top and bottom, the 100 rows on each of the left and right.
    expect(numbers).toHaveLength(75 * 2 + 100 * 2)
    expect(new Set(numbers.map((text) => text.font))).toEqual(new Set(['F1']))
    expect(numbers.filter((text) => text.value === '1')).toHaveLength(4)
    // Upright: no text matrix is ever set, so nothing is turned.
    expect(content.toString()).not.toContain(' Tm')
  })

  it.each([0, 90, 180, 270])('counts a trimmed chart turned %s° 1… left to right on the top and bottom, 1… top to bottom on the sides', (turn) => {
    // A 13 × 30 piece in the middle of a 30 × 39 Frame.
    const base = createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', size: { width: 30, height: 39, unit: 'beads' } })
    const beads = Object.fromEntries(Array.from({ length: 30 }, (_, row) => [row + 4, Object.fromEntries(Array.from({ length: 13 }, (_, column) => [column + 8, DARK]))]))
    const project = withLayers(base, { frame: { ...frameOf(base)!, beads }, orientation: turn, paletteLetters: LETTERS, letters: false })
    const plan = planWithKey(project)
    const numbers = rulerTexts(project, plan, plan.parts.filter((part) => part.page === plan.parts[0]!.page))
    const [across, down] = turn % 180 === 0 ? [13, 30] : [30, 13]
    const count = (length: number) => Array.from({ length }, (_, index) => String(index + 1))
    const top = Math.min(...numbers.map((text) => text.baseline))
    const bottom = Math.max(...numbers.map((text) => text.baseline))

    expect(plan.parts).toHaveLength(1)
    for (const edge of [top, bottom]) expect(numbers.filter((text) => text.baseline === edge && text.align === 'center').sort((p, q) => p.x - q.x).map((text) => text.value)).toEqual(count(across))
    for (const side of ['right', 'left']) expect(numbers.filter((text) => text.align === side).sort((p, q) => p.baseline - q.baseline).map((text) => text.value)).toEqual(count(down))
  })

  it('sets every ruler number `muted`, the overlap\'s `faint`, none in ink (ticket 1129)', () => {
    const { plan } = chartOf(schema('loom', 150, 100), 1)
    const numbers = rulerTexts(schema('loom', 150, 100), plan, [plan.parts[1]!])

    expect(new Set(numbers.filter((text) => Number(text.value) >= 76).map((text) => text.style.color))).toEqual(new Set([PRINT_COLORS.muted]))
    expect(new Set(numbers.filter((text) => ['74', '75'].includes(text.value) && text.baseline < mm(30)).map((text) => text.style.color))).toEqual(new Set([PRINT_COLORS.faint]))
  })

  it('sets every ruler number on a page in one size, the card\'s: 3.1 pt on part B of a 150 × 100, 2.4 pt on a 100 × 100 at 1.8 mm', () => {
    const wide = chartOf(schema('loom', 150, 100), 1)
    const small = chartOf(schema())
    const sizes = (content: PdfContent) => new Set(texts(content.toString()).filter((text) => /^\d+$/.test(text.value)).map((text) => text.size))

    expect([...sizes(wide.content)]).toHaveLength(1)
    expect([...sizes(wide.content)][0]).toBeCloseTo(3.1, 1)
    expect([...sizes(small.content)]).toHaveLength(1)
    expect([...sizes(small.content)][0]).toBeCloseTo(2.45, 1)
  })

  it('keeps 6.5 pt where the widest number fits, and a three-digit row under its band\'s 4.6 pt', () => {
    const piece = full('loom', 'miyuki-delica-11-0', 13, 30, 0)
    const roomy = planWithKey(piece)
    const long = full('loom', 'toho-cube-1.5mm', 20, 120, 0)
    const tall = planWithKey(long)

    expect(rulerNumberPt(piece, roomy, roomy.parts)).toBe(6.5)
    expect(rulerNumberPt(long, tall, tall.parts.filter((part) => part.page === tall.parts[0]!.page))).toBeLessThanOrEqual(4.6)
  })

  it('fits the widest column number in 80 % of its column and the widest row number\'s digits in 80 % of its row', () => {
    for (const project of [schema('loom', 150, 100), schema(), schema('peyote', 40, 140), schema('brick', 140, 40)]) {
      const plan = planPrint(project, { keyRows: 2 })
      const grid = displayedGrid(project)
      for (const page of new Set(plan.parts.map((part) => part.page))) {
        const parts = plan.parts.filter((part) => part.page === page)
        const size = rulerNumberPt(project, plan, parts)
        const widest = (key: 'lastAcross' | 'lastDown', first: number) => String(Math.max(...parts.map((part) => part[key] - first + 1)))
        expect(helveticaWidth(widest('lastAcross', plan.trim.firstAcross), 'regular', size)).toBeLessThanOrEqual(0.8 * grid.stepAcross * plan.zoom * K + 1e-9)
        expect(HELVETICA_CAP_HEIGHT * size).toBeLessThanOrEqual(0.8 * grid.stepDown * plan.zoom * K + 1e-9)
        expect(helveticaWidth(widest('lastDown', plan.trim.firstDown), 'regular', size)).toBeLessThanOrEqual(mmPt(2.7) + 1e-9)
      }
    }
  })

  it('draws the shared parts of one sheet in one size', () => {
    const project = full('loom', 'toho-cube-1.5mm', 35, 120, 0)
    const plan = planWithKey(project)
    const sheet = plan.parts.filter((part) => part.page === plan.parts[0]!.page)
    const sizes = new Set(rulerTexts(project, plan, sheet).map((text) => text.style.size))

    expect(sheet.length).toBeGreaterThan(1)
    expect(sizes.size).toBe(1)
  })

  it('carries part B of a 150 × 100 on from part A: its top ruler reads 74, 75 (the overlap), 76… 150', () => {
    const project = schema('loom', 150, 100)
    const { plan, part } = chartOf(project, 1)
    const numbers = rulerTexts(project, plan, [part])
    const top = Math.min(...numbers.map((text) => text.baseline))

    expect(part.overlapAcross).toBe(2)
    expect(numbers.filter((text) => text.baseline === top).map((text) => Number(text.value))).toEqual(Array.from({ length: 77 }, (_, index) => 74 + index))
  })

  it('tints the overlap 60 % toward white, with muted letters and faint numbers, under an accent line between columns 75 and 76', () => {
    const project = schema('loom', 150, 100, { frame: undefined })
    const painted = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 150, height: 100, unit: 'beads' } })
    const full: Record<number, Record<number, string>> = { 0: Object.fromEntries(Array.from({ length: 150 }, (_, column) => [column, DARK])) }
    const wide: Project = withLayers(project, { frame: { ...frameOf(painted)!, beads: full } })
    const { content } = chartOf(wide, 1)
    const pdf = content.toString()

    // #1f2a44 mixed 60 % toward white; the overlap's two columns carry muted letters, the rest white ones.
    expect(pdf).toContain('0.647 0.667 0.706 rg')
    const letters = texts(pdf).filter((text) => text.value === 'B')
    expect(letters).toHaveLength(77)
    expect(pdf).toContain('0.98 0.322 0.059 RG\n1.417 w')
  })

  it.each(['peyote', 'brick'] as const)('places and letters every bead of a %s Schema', (technique) => {
    const project = schema(technique, 40, 40)
    const { content } = chartOf(project)
    const letters = texts(content.toString()).filter((text) => text.font === 'F2' && /^[A-Z]+$/.test(text.value))

    expect(letters.length).toBeGreaterThan(0)
    expect(content.toString()).not.toContain('NaN')
  })

  it.each(TECHNIQUES)('draws a %s chart as cells, no bead outlined on its own (tickets 0642, 0644)', (technique) => {
    const pdf = chartOf(schema(technique, 40, 40)).content.toString()
    // A cell is a plain filled rectangle under the cell lines; an outlined bead would be a closed path, filled and stroked.
    expect((pdf.match(/ re f$/gm) ?? []).length).toBeGreaterThan(0)
    expect(pdf).not.toMatch(/ h B$/m)
  })

  it('places the beads of a turned Schema from the Project renderer', () => {
    const project = schema('loom', 40, 20, { orientation: 90 })
    const plan = planPrint(project, { keyRows: 2 })
    const placed = placeBeads(project, plan, plan.parts[0]!)

    expect(placed.filter((bead) => bead.color !== null)).toHaveLength(10 * 16)
    expect(Math.max(...placed.map((bead) => bead.across))).toBe(19)
  })
})

/** What a chart's parts draw, recorded: its lines with their width and colour, its rounded rectangles, its numbers. */
function drawn(project: Project, plan: PrintPlan, parts: PrintPlan['parts'], area?: { x: number; y: number }) {
  const lines: { segments: (readonly [number, number, number, number])[]; width: number; color: string }[] = []
  const rounds: { x: number; y: number; width: number; height: number; radius: number; paint: Paint }[] = []
  const numbers: { value: string; x: number; baseline: number; size: number; align?: string }[] = []
  const recorder: PageDrawing = {
    fillRect: () => {},
    lines: (segments, width, color) => {
      if (segments.length) lines.push({ segments: [...segments], width, color })
    },
    roundRect: (x, y, width, height, radius, paint) => rounds.push({ x, y, width, height, radius, paint }),
    polygon: () => {},
    text: (value, x, baseline, style, align) => {
      if (/^\d+$/.test(value)) numbers.push({ value, x, baseline, size: style.size, ...(align ? { align } : {}) })
    },
  }
  const pads = drawChartParts(recorder, project, plan, parts, LETTERS, area)
  // The rim: the one rounded outline with no fill (a round bead's circle is filled).
  const rims = rounds.filter((round) => round.paint.fill === undefined)
  return { lines, rounds, rims, numbers, pads }
}

/** A part's chart box on the page, in points: its pad less the ruler bands. */
function chartBoxOf(pad: { x: number; y: number }, part: PrintPlan['parts'][number]) {
  return { x: (pad.x + PRINT_RULER) * K, y: (pad.y + PRINT_RULER) * K, width: part.region.width * K, height: part.region.height * K }
}

/** The staggered and turned Schemas the ticket names, every position painted. */
const STAGGERED = [
  ['brick', 0, undefined], ['brick', 90, undefined],
  ['peyote', 0, undefined], ['peyote', 90, undefined],
  ['peyote two-drop', 0, { peyoteDrop: 2 }], ['peyote two-drop', 90, { peyoteDrop: 2 }],
  ['brick two-drop', 0, { brickDrop: 2 }], ['brick two-drop', 90, { brickDrop: 2 }],
] as const
const staggered = (name: string, turn: number, settings?: Record<string, number>) => full(name.startsWith('brick') ? 'brick' : 'peyote', 'miyuki-delica-11-0', 13, 30, turn, settings)

describe('the chart has no bold lines, each bead its own border and one rim (ticket 1126)', () => {
  const cell = { width: mmPt(0.1), color: PRINT_COLORS.lineStrong }

  it.each<[string, () => { project: Project; plan: PrintPlan; parts: PrintPlan['parts']; area?: { x: number; y: number } }]>([
    ['a chart page', () => ({ project: schema(), plan: planPrint(schema(), { keyRows: 2 }), parts: planPrint(schema(), { keyRows: 2 }).parts })],
    ['part B, its overlap', () => ({ project: schema('loom', 150, 100), plan: planPrint(schema('loom', 150, 100), { keyRows: 2 }), parts: [planPrint(schema('loom', 150, 100), { keyRows: 2 }).parts[1]!] })],
    ['page 1 and the PNG', () => {
      const project = full('loom', 'miyuki-delica-11-0', 13, 30, 0)
      const layout = pageOneLayout(project, { name: 'Piece', maker: '', colors: [{ hex: DARK, name: 'Dark', beads: '1' }] })
      return { project, plan: layout.plan, parts: layout.plan.parts, area: layout.area }
    }],
    ...STAGGERED.map(([name, turn, settings]) => [`${name} at ${turn}°`, () => {
      const project = staggered(name, turn, settings)
      const plan = planPrint(project, { keyRows: 2 })
      return { project, plan, parts: plan.parts }
    }] as [string, () => { project: Project; plan: PrintPlan; parts: PrintPlan['parts'] }]),
  ])('draws no line every 5th or 10th and no edge on %s: only the beads\' hairlines, the crosses and the overlap line', (_, make) => {
    const { project, plan, parts, area } = make()
    const kinds = new Set(drawn(project, plan, parts, area).lines.map(({ width, color }) => `${width.toFixed(3)} ${color}`))

    const allowed = [`${cell.width.toFixed(3)} ${cell.color}`, `${cell.width.toFixed(3)} ${PRINT_COLORS.faint}`, `${mmPt(0.5).toFixed(3)} ${PRINT_COLORS.accent}`]
    expect([...kinds].filter((kind) => !allowed.includes(kind))).toEqual([])
  })

  it.each<[string, () => Project, number]>([
    ...STAGGERED.map(([name, turn, settings]) => [`${name} at ${turn}°`, () => staggered(name, turn, settings), 0] as [string, () => Project, number]),
    ['loom, part B with its overlap', () => full('loom', 'toho-cube-1.5mm', 150, 20, 0), 1],
  ])('borders every bead of a %s chart round its own cell, one hairline between neighbours and none astray', (_, make, index) => {
    const project = make()
    const plan = planPrint(project, { keyRows: 2 })
    const part = plan.parts[index]!
    const { lines, pads } = drawn(project, plan, [part])
    const chart = chartBoxOf(pads[0]!, part)
    const segments = lines.filter(({ width, color }) => width === cell.width && color === cell.color).flatMap(({ segments }) => segments)
    const edges = placeBeads(project, plan, part).flatMap(({ cell: box }) => {
      const [left, top, right, bottom] = [chart.x + box.x * K, chart.y + box.y * K, chart.x + (box.x + box.width) * K, chart.y + (box.y + box.height) * K]
      return [[left, top, right, top], [left, bottom, right, bottom], [left, top, left, bottom], [right, top, right, bottom]] as const
    })
    const near = (p: number, q: number) => Math.abs(p - q) < 0.05
    const along = ([x1, y1, x2, y2]: readonly number[], x: number, y: number) =>
      near(x1!, x2!) ? near(x, x1!) && y >= Math.min(y1!, y2!) - 0.05 && y <= Math.max(y1!, y2!) + 0.05 : near(y, y1!) && x >= Math.min(x1!, x2!) - 0.05 && x <= Math.max(x1!, x2!) + 0.05

    // Every bead's four sides are drawn.
    for (const [x1, y1, x2, y2] of edges) expect(segments.some((segment) => along(segment, x1, y1) && along(segment, x2, y2) && along(segment, (x1 + x2) / 2, (y1 + y2) / 2))).toBe(true)
    // Every point of every line is on a bead's side: no step, no stray segment.
    for (const [x1, y1, x2, y2] of segments) {
      for (let share = 0; share <= 1; share += 1 / 64) expect(edges.some((edge) => along(edge, x1 + (x2 - x1) * share, y1 + (y2 - y1) * share))).toBe(true)
    }
    // No hairline is drawn twice: collinear lines never overlap.
    for (const [index, p] of segments.entries()) {
      for (const q of segments.slice(index + 1)) {
        const horizontal = near(p[1], p[3]) && near(q[1], q[3]) && near(p[1], q[1])
        const vertical = near(p[0], p[2]) && near(q[0], q[2]) && near(p[0], q[0])
        const span = (r: readonly number[], at: 0 | 1) => [Math.min(r[at]!, r[at + 2]!), Math.max(r[at]!, r[at + 2]!)]
        const overlap = (at: 0 | 1) => Math.min(span(p, at)[1]!, span(q, at)[1]!) - Math.max(span(p, at)[0]!, span(q, at)[0]!)
        if (horizontal) expect(overlap(0)).toBeLessThan(0.05)
        if (vertical) expect(overlap(1)).toBeLessThan(0.05)
      }
    }
  })

  it.each<[string, () => Project]>([
    ['loom', () => schema()],
    ...STAGGERED.map(([name, turn, settings]) => [`${name} at ${turn}°`, () => staggered(name, turn, settings)] as [string, () => Project]),
    ['Custom frame', () => triangleOf(9)],
  ])('draws one rounded rim 1 mm clear of a %s chart\'s outermost beads, 0.2 mm faint with 2 mm corners, no bead touching it', (_, make) => {
    const project = make()
    const plan = planPrint(project, { keyRows: 2 })
    for (const part of plan.parts) {
      const { rims, pads } = drawn(project, plan, [part])
      const chart = chartBoxOf(pads[0]!, part)

      expect(rims).toHaveLength(1)
      const [rim] = rims
      expect(rim!.paint).toEqual({ stroke: PRINT_COLORS.faint, lineWidth: mmPt(0.2) })
      expect(rim!.radius).toBeCloseTo(mmPt(2), 5)
      expect(rim!.x).toBeCloseTo(chart.x - mmPt(1), 3)
      expect(rim!.y).toBeCloseTo(chart.y - mmPt(1), 3)
      expect(rim!.x + rim!.width).toBeCloseTo(chart.x + chart.width + mmPt(1), 3)
      expect(rim!.y + rim!.height).toBeCloseTo(chart.y + chart.height + mmPt(1), 3)
      // The beads stay inside the chart's box (ticket 1122's placement test), so the rim stands 1 mm clear of each.
      if (!customChart(project, part.region, plan.zoom)) {
        for (const { box } of placeBeads(project, plan, part)) {
          expect(chart.x + box.x * K - rim!.x).toBeGreaterThan(mmPt(1) - 0.5 * K - 1e-6)
          expect(rim!.x + rim!.width - chart.x - (box.x + box.width) * K).toBeGreaterThan(mmPt(1) - 0.5 * K - 1e-6)
        }
      }
    }
  })

  it('stands the ruler numbers outside the rim: columns 1.5 mm above and below it, rows 1.3 mm beside it', () => {
    const project = schema('loom', 150, 100)
    const plan = planPrint(project, { keyRows: 2 })
    const { rims, numbers } = drawn(project, plan, [plan.parts[1]!])
    const rim = rims[0]!
    const cap = HELVETICA_CAP_HEIGHT * numbers[0]!.size
    const columns = numbers.filter((number) => number.align === 'center')
    const top = Math.min(...columns.map((number) => number.baseline))
    const bottom = Math.max(...columns.map((number) => number.baseline))

    expect(top).toBeCloseTo(rim.y - mmPt(1.5), 3)
    expect(bottom - cap).toBeCloseTo(rim.y + rim.height + mmPt(1.5), 3)
    expect(new Set(numbers.filter((number) => number.align === 'right').map((number) => number.x.toFixed(3)))).toEqual(new Set([(rim.x - mmPt(1.3)).toFixed(3)]))
    expect(new Set(numbers.filter((number) => number.align === 'left').map((number) => number.x.toFixed(3)))).toEqual(new Set([(rim.x + rim.width + mmPt(1.3)).toFixed(3)]))
  })

  it('draws neither the rim nor the empty positions\' outline and cross with the look\'s switches off, the numbers in place', () => {
    const project = schema('loom', 30, 30)
    const plan = planPrint(project, { keyRows: 2 })
    const on = drawn(project, plan, plan.parts)
    const off: string[] = []
    const numbers: string[] = []
    const recorder: PageDrawing = {
      fillRect: () => {},
      lines: (segments, width, color) => segments.length && off.push(`${width} ${color}`),
      roundRect: (...args) => off.push(`round ${args[5].fill ?? 'none'}`),
      polygon: () => {},
      text: (value, x, baseline) => /^\d+$/.test(value) && numbers.push(`${value} ${x} ${baseline}`),
    }
    drawChartParts(recorder, project, plan, plan.parts, LETTERS, undefined, { rim: false, emptyGrid: false })

    expect(on.rims).toHaveLength(1)
    expect(off.filter((kind) => kind === 'round none')).toEqual([])
    expect(off.filter((kind) => kind === `${cell.width} ${PRINT_COLORS.faint}`)).toEqual([])
    expect(numbers).toEqual(on.numbers.map(({ value, x, baseline }) => `${value} ${x} ${baseline}`))
  })

  it('keeps a round bead\'s circle and its hairline edge, with no line between the circles', () => {
    const base = createProject({ technique: 'loom', beadId: 'toho/round/8-0', size: { width: 12, height: 12, unit: 'beads' } })
    const project = withLayers(base, { frame: { ...frameOf(base)!, beads: { 0: Object.fromEntries(Array.from({ length: 12 }, (_, column) => [column, DARK])) } }, paletteLetters: LETTERS, letters: false })
    const plan = planPrint(project, { keyRows: 2 })
    const { rounds, lines } = drawn(project, plan, plan.parts)
    const circles = rounds.filter((round) => round.paint.fill !== undefined)

    expect(circles).toHaveLength(12)
    expect(circles.every((circle) => circle.paint.stroke === PRINT_COLORS.lineStrong && circle.paint.lineWidth === cell.width && circle.radius >= circle.width / 2)).toBe(true)
    expect(lines.filter(({ color }) => color === PRINT_COLORS.lineStrong)).toHaveLength(0)
  })

  it('keeps an overlap bead\'s tint under its border', () => {
    const project = full('loom', 'toho-cube-1.5mm', 150, 100, 0)
    const plan = planPrint(project, { keyRows: 2 })
    const pdf = pdfOf(project, plan, [plan.parts[1]!], LETTERS).content.toString()

    // #1f2a44 mixed 60 % toward white, and the beads' hairline in line-strong.
    expect(pdf).toContain('0.647 0.667 0.706 rg')
    expect(pdf).toContain('0.78 0.78 0.78 RG\n0.283 w')
  })
})

/** The page's height in points: A4 portrait at 150 dpi. */
function plan842(): number {
  return (1754 * 72) / 150
}

/** A peyote Triangle of `size` rounds on a loom Canvas, its inner rounds painted dark and its 4th round White. */
function triangleOf(size: number): Project {
  const centre = Math.max(20, size * 2)
  const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
  const placed = changeFrame(open, { custom: { shape: 'triangle', size, centre: { row: centre, column: centre } } })
  if (placed.kind !== 'changed') throw new Error('expected a Triangle')
  const positions = frameLayoutOf(frameOf(placed.project)!)!.positions
  const dark = onLayer(placed.project, 'frame', (view) => paintCells(view, positions.filter(({ row }) => row < 3), DARK))
  const white = onLayer(dark, 'frame', (view) => paintCells(view, positions.filter(({ row }) => row === 3), '#ffffff'))
  return withLayers(white, { paletteLetters: LETTERS, letters: false })
}

describe('a Custom frame\'s chart page (ticket 0594)', () => {
  const triangle = () => triangleOf(9)

  it('tiles the bounding rectangle and letters every painted bead once, across the parts', () => {
    const project = triangle()
    const plan = planPrint(project, { keyRows: 2 })
    const lettered = plan.parts.flatMap((part) => texts(pdfOf(project, plan, [part], LETTERS).content.toString()).filter((text) => /^[A-Z]+$/.test(text.value)))
    // 3 + 6 + 9 dark and 12 White, the overlap's repeats aside: at least each once.
    expect(lettered.filter((text) => text.value === 'B').length).toBeGreaterThanOrEqual(18)
    expect(lettered.filter((text) => text.value === 'A').length).toBeGreaterThanOrEqual(12)
  })

  it('draws each bead turned to its panel as a closed path, the empty ones outlined with Empty grid on, and the Seams, with no rulers', () => {
    const project = triangle()
    const { content } = chartOf(project, 0, EMPTY_GRID_ON)
    const pdf = content.toString()
    const turned = pdf.split('\n').filter((line) => / l .* h [BfS]$/.test(line) && !line.includes(' c '))
    expect(turned.length).toBe(frameLayoutOf(frameOf(project)!)!.positions.length)
    expect(turned.filter((line) => line.endsWith(' S')).length).toBe(frameLayoutOf(frameOf(project)!)!.positions.length - 30)
    // Each empty one carries the cross too (ticket 0818).
    expect(crossArms(pdf)).toHaveLength((frameLayoutOf(frameOf(project)!)!.positions.length - 30) * 2)
    // No ruler numbers: the only text is the beads' letters.
    expect(texts(pdf).every((text) => /^[A-Z]+$/.test(text.value))).toBe(true)
  })
})

describe('Empty grid and Chart border (ticket 1127)', () => {
  /** Every call a chart's parts make, in order, as text: what the page would draw. */
  function calls(project: Project, plan: PrintPlan, look: { rim: boolean; emptyGrid: boolean }) {
    const made: string[] = []
    const recorder: PageDrawing = {
      fillRect: (...args) => made.push(`fill ${JSON.stringify(args)}`),
      lines: (segments, width, color) => segments.length && made.push(`lines ${width} ${color} ${JSON.stringify(segments)}`),
      roundRect: (...args) => made.push(`round ${JSON.stringify(args)}`),
      polygon: (...args) => made.push(`polygon ${JSON.stringify(args)}`),
      text: (...args) => made.push(`text ${JSON.stringify(args)}`),
    }
    drawChartParts(recorder, project, plan, plan.parts, LETTERS, undefined, look)
    return made
  }
  const faint = (made: string[]) => made.filter((call) => call.includes(`"stroke":"${PRINT_COLORS.faint}"`) || call.startsWith(`lines ${mmPt(0.1)} ${PRINT_COLORS.faint}`))

  it('reads the look from the export\'s words: the rim with Chart border, the empty positions with Empty grid, neither as the words start', () => {
    expect(chartLookOf({})).toEqual({ rim: false, emptyGrid: false })
    expect(chartLookOf({ chartBorder: true })).toEqual({ rim: true, emptyGrid: false })
    expect(chartLookOf({ emptyGrid: true, chartBorder: true })).toEqual({ rim: true, emptyGrid: true })
  })

  it('with Chart border off draws everything but the rim, each in its place', () => {
    const project = schema('loom', 30, 30)
    const plan = planPrint(project, { keyRows: 2 })
    const on = calls(project, plan, EMPTY_GRID_ON)
    const off = calls(project, plan, { rim: false, emptyGrid: true })
    const rims = on.filter((call) => call.startsWith('round') && !call.includes('"fill"'))

    expect(rims).toHaveLength(1)
    expect(off).toEqual(on.filter((call) => call !== rims[0]))
  })

  it('with Empty grid off leaves every empty position bare paper and draws the colored beads as with it on', () => {
    const project = schema('loom', 30, 30)
    const plan = planPrint(project, { keyRows: 2 })
    const part = plan.parts[0]!
    const on = calls(project, plan, EMPTY_GRID_ON)
    const off = calls(project, plan, { rim: true, emptyGrid: false })

    // No faint cross and no empty position's border; the fills, the letters, the numbers and the rim are the same.
    expect(faint(on).length).toBeGreaterThan(0)
    expect(faint(off.filter((call) => !call.startsWith('round')))).toEqual([])
    expect(off.filter((call) => !call.startsWith('lines'))).toEqual(on.filter((call) => !call.startsWith('lines')))
    // Every hairline left is a side of a colored bead.
    const { pads } = drawn(project, plan, [part])
    const chart = chartBoxOf(pads[0]!, part)
    const colored = placeBeads(project, plan, part).filter((bead) => bead.color !== null)
    const segments = off.filter((call) => call.startsWith(`lines ${mmPt(0.1)} ${PRINT_COLORS.lineStrong}`)).flatMap((call) => JSON.parse(call.slice(call.indexOf('[['))) as number[][])
    const onSide = (x: number, y: number) => colored.some(({ cell }) => {
      const [left, top, right, bottom] = [chart.x + cell.x * K, chart.y + cell.y * K, chart.x + (cell.x + cell.width) * K, chart.y + (cell.y + cell.height) * K]
      const within = (value: number, from: number, to: number) => value >= from - 0.05 && value <= to + 0.05
      return ((Math.abs(x - left) < 0.05 || Math.abs(x - right) < 0.05) && within(y, top, bottom)) || ((Math.abs(y - top) < 0.05 || Math.abs(y - bottom) < 0.05) && within(x, left, right))
    })
    expect(segments.length).toBeGreaterThan(0)
    for (const [x1, y1, x2, y2] of segments) expect(onSide((x1! + x2!) / 2, (y1! + y2!) / 2)).toBe(true)
  })

  it('outlines a Custom frame\'s empty position only where it lies wholly inside the trimmed rectangle, and none with Empty grid off', () => {
    // A Triangle whose painted beads take the first five positions: trimmed to them, its rim's empties reach past it.
    const triangle = triangleOf(9)
    const positions = frameLayoutOf(frameOf(triangle)!)!.positions
    const project = onLayer(withLayers(triangle, { frame: { ...frameOf(triangle)!, beads: {} } }), 'frame', (view) => paintCells(view, positions.slice(0, 5), DARK))
    const plan = planWithKey(project)
    expect(plan.parts).toHaveLength(1)
    const part = plan.parts[0]!
    const empties = (look: { rim: boolean; emptyGrid: boolean }) => {
      const outlines: (readonly (readonly [number, number])[])[] = []
      const recorder: PageDrawing = {
        fillRect: () => {},
        lines: () => {},
        roundRect: () => {},
        polygon: (points, paint) => paint.fill === undefined && outlines.push(points),
        text: () => {},
      }
      return { outlines, pads: drawChartParts(recorder, project, plan, [part], LETTERS, undefined, look) }
    }
    const { outlines, pads } = empties(EMPTY_GRID_ON)
    const chart = chartBoxOf(pads[0]!, part)
    const inside = ([x, y]: readonly [number, number]) => x >= chart.x - 1e-3 && x <= chart.x + chart.width + 1e-3 && y >= chart.y - 1e-3 && y <= chart.y + chart.height + 1e-3
    // The empty positions whose centre is in the trimmed rectangle: those a part takes as its own.
    const centred = customChart(project, part.region, plan.zoom)!.beads.filter((bead) => bead.color === null && bead.x >= 0 && bead.x < part.region.width && bead.y >= 0 && bead.y < part.region.height)

    expect(outlines.length).toBeGreaterThan(0)
    expect(outlines.every((points) => points.every(inside))).toBe(true)
    expect(outlines.length).toBeLessThan(centred.length)
    expect(empties({ rim: true, emptyGrid: false }).outlines).toEqual([])
  })
})

describe('a turned Frame\'s chart page (ticket 0667)', () => {
  it('prints the Frame as it lies, each bead turned with it, and with no rulers', () => {
    const upright = schema('peyote', 6, 4, { letters: false, paletteLetters: LETTERS })
    const project = rotateFrame(upright)!
    const pdf = chartOf(project).content.toString()
    const turned = pdf.split('\n').filter((line) => / l .* h [BfS]$/.test(line) && !line.includes(' c '))
    expect(turned.length).toBe(6 * 4)
    expect(texts(pdf).every((text) => /^[A-Z]+$/.test(text.value))).toBe(true)
  })
})

describe('every bead shape at the smallest and the largest bead (ticket 0913)', () => {
  /** Loom with round beads, its first row painted. */
  function round(columns: number, rows: number): Project {
    const base = createProject({ technique: 'loom', beadId: 'toho/round/8-0', size: { width: columns, height: rows, unit: 'beads' } })
    return withLayers(base, { frame: { ...frameOf(base)!, beads: { 0: Object.fromEntries(Array.from({ length: columns }, (_, column) => [column, DARK])) } }, paletteLetters: LETTERS, letters: false })
  }

  // A Triangle is at most 81 beads wide, 2.2 mm a bead whole: its 1.8 mm page is drawn on a 100 × 100's plan. A round
  // bead on the loom is half again as tall as it is wide, so 66 of its rows fill the sheet as 100 square ones do.
  it.each<[string, number, () => Project, (() => Project)?]>([
    ['round', 9, () => round(12, 12)],
    ['brick', 9, () => schema('brick', 12, 12)],
    ['peyote', 9, () => schema('peyote', 12, 12)],
    ['Custom frame', 9, () => triangleOf(9)],
    ['round', 1.8, () => round(100, 66)],
    ['brick', 1.8, () => schema('brick', 100, 100)],
    ['peyote', 1.8, () => schema('peyote', 100, 100)],
    ['Custom frame', 1.8, () => triangleOf(50), () => schema('loom', 100, 100)],
  ])('draws a %s chart at %s mm a bead, every painted bead lettered inside its cell', (_, beadMm, make, planned = make) => {
    const project = make()
    const plan = planPrint(planned(), { keyRows: 2 })
    const pdf = plan.parts.map((part) => pdfOf(project, plan, [part], LETTERS).content.toString()).join('\n')
    const letters = texts(pdf).filter((text) => /^[A-Z]+$/.test(text.value))
    const cell = plan.beadMm * (72 / 25.4)

    expect(plan.beadMm).toBeGreaterThan(beadMm - 0.25)
    expect(plan.beadMm).toBeLessThanOrEqual(Math.max(beadMm, 2))
    expect(pdf).not.toContain('NaN')
    expect(letters.length).toBeGreaterThan(0)
    expect(letters.every((text) => (helveticaWidth(text.value, 'bold', text.size) * text.scale) / 100 <= cell)).toBe(true)
    expect(letters.every((text) => Math.abs(text.size - letterPt(plan.beadMm)) < 0.01)).toBe(true)
  })
})

describe('a turned Schema prints every bead in its place (ticket 1122)', () => {
  /** Every part's beads, each where it stands in the whole displayed chart, the overlap's repeats left out. */
  function printed(project: Project) {
    const plan = planPrint(project, { keyRows: 2 })
    return plan.parts.flatMap((part) => placeBeads(project, plan, part).map((bead) => ({ ...bead, part, across: part.firstAcross - part.overlapAcross + bead.across, down: part.firstDown - part.overlapDown + bead.down })))
      .filter(({ part, across, down }) => across >= part.firstAcross && down >= part.firstDown)
  }

  const cases = TECHNIQUES.flatMap((technique) => ['toho-cube-1.5mm', 'miyuki-delica-11-0'].flatMap((beadId) => [0, 90, 180, 270].map((turn) => [technique, beadId, turn] as const)))
  it.each(cases)('places every bead of a full %s Schema in %s turned %s° once, in its own column and row, inside its part', (technique, beadId, turn) => {
    const project = full(technique, beadId, 13, 30, turn)
    const grid = displayedGrid(project)
    const beads = printed(project)
    const { columns, rows } = frameOf(project)!

    expect(beads).toHaveLength(columns * rows)
    expect(new Set(beads.map(({ across, down }) => `${across}:${down}`)).size).toBe(columns * rows)
    expect(new Set(beads.map((bead) => bead.across)).size).toBe(grid.across)
    expect(new Set(beads.map((bead) => bead.down)).size).toBe(grid.down)
    expect([Math.min(...beads.map((bead) => bead.across)), Math.max(...beads.map((bead) => bead.across))]).toEqual([0, grid.across - 1])
    expect([Math.min(...beads.map((bead) => bead.down)), Math.max(...beads.map((bead) => bead.down))]).toEqual([0, grid.down - 1])
    // The beads reach each part's far edges: its region is as big as they are.
    for (const part of new Set(beads.map((bead) => bead.part))) {
      const own = beads.filter((bead) => bead.part === part)
      expect(Math.max(...own.map(({ box }) => box.x + box.width))).toBeGreaterThan(part.region.width - 1)
      expect(Math.max(...own.map(({ box }) => box.y + box.height))).toBeGreaterThan(part.region.height - 1)
    }
    for (const { box, part } of beads) {
      expect(box.x).toBeGreaterThanOrEqual(-0.5)
      expect(box.y).toBeGreaterThanOrEqual(-0.5)
      expect(box.x + box.width).toBeLessThanOrEqual(part.region.width + 0.5)
      expect(box.y + box.height).toBeLessThanOrEqual(part.region.height + 0.5)
    }
    // Each bead stands under its own ruler number, within the half bead a staggered row or column is shifted by.
    const { zoom } = planPrint(project, { keyRows: 2 })
    const step = { across: grid.stepAcross * zoom, down: grid.stepDown * zoom }
    for (const { cell, part, across, down } of beads) {
      expect(Math.abs(cell.x - (across - part.firstAcross + part.overlapAcross) * step.across)).toBeLessThanOrEqual(step.across / 2 + 0.5)
      expect(Math.abs(cell.y - (down - part.firstDown + part.overlapDown) * step.down)).toBeLessThanOrEqual(step.down / 2 + 0.5)
    }
    // Further across is further right, further down is lower: the rulers stand over the beads they count.
    const sorted = (key: 'across' | 'down', other: 'across' | 'down', side: 'x' | 'y') => [...beads].filter((bead) => bead[other] === 0).sort((p, q) => p[key] - q[key]).map((bead) => bead.box[side])
    expect(sorted('across', 'down', 'x')).toEqual([...sorted('across', 'down', 'x')].sort((p, q) => p - q))
    expect(sorted('down', 'across', 'y')).toEqual([...sorted('down', 'across', 'y')].sort((p, q) => p - q))
  })

  it.each([['loom', 90], ['loom', 270], ['brick', 90], ['brick', 270]] as const)('numbers a turned %s Schema\'s rows over the beads of those rows, as Row by row names them (%s°)', (technique, turn) => {
    // Each row its own color, so a bead tells its row.
    const base = full(technique, 'miyuki-delica-11-0', 13, 30, turn)
    const { columns, rows } = frameOf(base)!
    const hexOf = (row: number) => `#0000${row.toString(16).padStart(2, '0')}`
    const beads = Object.fromEntries(Array.from({ length: rows }, (_, row) => [row, Object.fromEntries(Array.from({ length: columns }, (_, column) => [column, hexOf(row)]))]))
    const project = withLayers(base, { frame: { ...frameOf(base)!, beads }, paletteLetters: Object.fromEntries(Array.from({ length: rows }, (_, row) => [hexOf(row), partLetter(row)])) })
    const { trim } = planPrint(project, { keyRows: 2 })
    // Each Schema row's beads stand under one ruler number, and Row by row gives that row the same number (ticket 1129).
    const rulerOf = new Map(printed(project).map((bead) => [project.paletteLetters![bead.color!], acrossNumber(trim, bead.across)]))
    const words = wordChartOf(project)!.rows

    expect(rulerOf.size).toBe(rows)
    expect(words).toHaveLength(rows)
    for (const row of words) expect(row.number).toBe(rulerOf.get(row.runs[0]!.letter!))
    expect([...rulerOf.values()].sort((p, q) => p - q)).toEqual(Array.from({ length: rows }, (_, index) => index + 1))
  })

  // The shapes of the owner's exports the cases above leave out (a loom 13 × 30 is one of them).
  it.each([
    ['loom', 30, 39, undefined],
    ['peyote', 13, 24, { peyoteDrop: 2 }],
  ] as const)('prints a %s %s × %s Delica Schema turned 90° whole', (technique, columns, rows, settings) => {
    const project = full(technique, 'miyuki-delica-11-0', columns, rows, 90, settings)
    const frame = frameOf(project)!

    expect(printed(project)).toHaveLength(frame.columns * frame.rows)
  })
})

describe('a Custom frame prints every bead (ticket 1132)', () => {
  /** A Custom frame of `shape` at `size` on a loom Canvas in `beadId`, every bead painted. */
  function customOf(shape: FrameShapeId, beadId: string, size: number): Project {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId, size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape, size, centre: { row: 100, column: 100 } } })
    if (placed.kind !== 'changed') throw new Error(`expected a ${shape}`)
    const painted = onLayer(placed.project, 'frame', (view) => paintCells(view, [...frameLayoutOf(frameOf(placed.project)!)!.positions], DARK))
    return withLayers(painted, { paletteLetters: LETTERS, letters: false })
  }

  /** Every painted bead each part draws: its centre and corners in the whole displayed chart, and whether it is the
   * overlap's repeat, tinted. */
  function beadsOnParts(project: Project, plan: PrintPlan, area?: { x: number; y: number }) {
    return plan.parts.flatMap((part) => {
      const drawn: { points: readonly (readonly [number, number])[]; fill: string }[] = []
      const record: PageDrawing = {
        fillRect() {},
        lines() {},
        roundRect() {},
        text() {},
        polygon(points, { fill }) {
          if (fill) drawn.push({ points, fill })
        },
      }
      const [pad] = drawChartParts(record, project, plan, [part], LETTERS, area)
      const chart = { x: pad!.x + PRINT_RULER - part.region.x, y: pad!.y + PRINT_RULER - part.region.y }
      return drawn.map(({ points, fill }) => {
        const corners = points.map(([x, y]) => ({ x: x / K - chart.x, y: y / K - chart.y }))
        const centre = { x: corners.reduce((sum, { x }) => sum + x, 0) / 4, y: corners.reduce((sum, { y }) => sum + y, 0) / 4 }
        return { part, centre, corners, repeat: fill !== DARK }
      })
    })
  }

  /** Every bead of the Custom frame printed once across the plan's parts, the overlap's repeats aside: its centre inside
   * its part, the whole of it inside the chart, and the parts together as big as the whole chart the overview draws. Gives
   * where each one stands. */
  function expectEveryBeadOnce(project: Project, plan: PrintPlan, area?: { x: number; y: number }): string[] {
    const positions = frameLayoutOf(frameOf(project)!)!.positions.length
    const beads = beadsOnParts(project, plan, area)
    const own = beads.filter((bead) => !bead.repeat)
    const whole = wholeChart(project, plan.zoom)

    const places = own.map(({ centre }) => placeOf(centre))
    expect(own).toHaveLength(positions)
    expect(new Set(places).size).toBe(positions)
    for (const { part, centre, corners } of beads) {
      expect(centre.x).toBeGreaterThanOrEqual(part.region.x - 0.5)
      expect(centre.y).toBeGreaterThanOrEqual(part.region.y - 0.5)
      expect(centre.x).toBeLessThanOrEqual(part.region.x + part.region.width + 0.5)
      expect(centre.y).toBeLessThanOrEqual(part.region.y + part.region.height + 0.5)
      // Nothing past the chart's edge.
      for (const { x, y } of corners) {
        expect(x).toBeGreaterThanOrEqual(-0.5)
        expect(y).toBeGreaterThanOrEqual(-0.5)
        expect(x).toBeLessThanOrEqual(whole.width + 0.5)
        expect(y).toBeLessThanOrEqual(whole.height + 0.5)
      }
    }
    // A region is whole px, so the parts end within a px of the chart's edge.
    const ends = { across: Math.max(...plan.parts.map(({ region }) => region.x + region.width)), down: Math.max(...plan.parts.map(({ region }) => region.y + region.height)) }
    expect(ends.across - whole.width).toBeGreaterThanOrEqual(0)
    expect(ends.across - whole.width).toBeLessThan(1)
    expect(ends.down - whole.height).toBeGreaterThanOrEqual(0)
    expect(ends.down - whole.height).toBeLessThan(1)
    return places
  }

  /** The whole displayed chart's size at `zoom`, as the overview lays it. */
  function wholeChart(project: Project, zoom: number) {
    const { technique, cell } = frameWeave(project)
    const { columns, rows } = projectDimensions(project)
    return displayedExtentPx(technique, columns, rows, zoom, quarterTurnOf(project), cell)
  }

  /** A bead's centre to the px, in the whole displayed chart. */
  const placeOf = ({ x, y }: { x: number; y: number }) => `${Math.round(x)}:${Math.round(y)}`

  const words = { name: 'Triangle', maker: '', colors: [{ hex: DARK, name: 'Dark', beads: '1' }] }
  const cases = FRAME_SHAPE_IDS.flatMap((shape) => ['toho-cube-1.5mm', 'miyuki-delica-11-0'].map((beadId) => [shape, beadId] as const))

  it.each(cases)('draws every bead of a %s in %s once, inside the chart, on page 1 and the PNG', (shape, beadId) => {
    const project = customOf(shape, beadId, 5)
    const layout = pageOneLayout(project, words)

    expect(chartOnPageOne(layout.plan)).toBe(true)
    // The PNG is page 1 as a picture: the same plan drawn into the same area (ticket 0915).
    expectEveryBeadOnce(project, layout.plan, layout.area)
  })

  it.each(cases)('draws every bead of a %s in %s once across its chart pages, inside the chart, as the overview does', (shape, beadId) => {
    const project = customOf(shape, beadId, 9)
    // A bead this large cuts every shape into parts.
    const plan = planPrint(project, { keyRows: 2, floorMm: 12 })

    expect(plan.parts.length).toBeGreaterThan(1)
    const places = expectEveryBeadOnce(project, plan)
    // The overview draws the whole chart, at its own zoom: the same beads in the same places.
    const whole = wholeChart(project, plan.zoom)
    const overview = customChart(project, { x: 0, y: 0, ...whole }, plan.zoom)!.beads.map(placeOf)
    expect([...overview].sort()).toEqual([...places].sort())
  })
})

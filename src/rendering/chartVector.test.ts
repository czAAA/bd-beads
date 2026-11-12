import { describe, expect, it } from 'vitest'
import { changeFrame } from '../domain/changeFrame'
import { rotateFrame } from '../domain/rotate'
import { frameLayoutOf } from '../domain/frameShape'
import { onLayer } from '../domain/layers'
import { createProject } from '../domain/createProject'
import { paintCells } from '../domain/drawing'
import type { Project } from '../domain/project'
import { TECHNIQUES, type Technique } from '../domain/weave'
import { drawChartParts, K, letterColor, letterPt, placeBeads } from './chartVector'
import { helveticaWidth } from '../domain/helvetica'
import { EMPTY_CROSS_SHARE } from './printPages'
import { displayedGrid, planPrint, mm } from './printPlan'
import { frameOf, withFrameSheet } from '../domain/layerRecord'
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

function chartOf(project: Project, part = 0) {
  const plan = planPrint(project, undefined, 0, 2)
  const parts = [plan.parts[part]!]
  return { plan, part: parts[0]!, ...drawChartParts(project, plan, parts, plan.page.height, LETTERS) }
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
    expect(texts(drawChartParts(withLayers(project, { letters: true }), planPrint(project, undefined, 0, 2), [part], 1754, LETTERS).content.toString()).filter((text) => /^[A-Z]+$/.test(text.value))).toHaveLength(painted)
  })

  it('scales the Swatch letter with the bead: 6.5 pt at 3 mm, about 4.3 pt at 1.8 mm, larger above 3 mm (ticket 0913)', () => {
    expect(letterPt(3)).toBeCloseTo(6.5, 5)
    expect(letterPt(1.8)).toBeGreaterThan(4.2)
    expect(letterPt(1.8)).toBeLessThan(4.35)
    expect(letterPt(9)).toBeGreaterThan(letterPt(3) * 2.9)
  })

  it('keeps a two-letter Swatch letter inside its cell, setting a wide one smaller', () => {
    const wide = { [DARK]: 'WM', '#ffffff': 'A', '#f2c94c': 'AA' }
    const plan = planPrint(schema(), undefined, 0, 2)
    const pdf = drawChartParts(schema(), plan, plan.parts, plan.page.height, wide).content.toString()
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

  it('marks every empty position, and only those, with a small faint cross, 0.1 mm (ticket 0818)', () => {
    const { part, content } = chartOf(schema())
    const crosses = crossArms(content.toString())
    const positions = (part.lastAcross - part.firstAcross + 1) * (part.lastDown - part.firstDown + 1)

    expect(crosses).toHaveLength((positions - 10 * 16) * 2)
  })

  it('marks an empty position among round beads with the same cross, 40 % of the bead across (ticket 0818)', () => {
    const base = createProject({ technique: 'loom', beadId: 'toho/round/8-0', size: { width: 4, height: 4, unit: 'beads' } })
    const project = withLayers(base, { frame: { ...frameOf(base)!, beads: { 0: { 0: DARK } } }, paletteLetters: LETTERS, letters: false })
    const { plan, part, content } = chartOf(project)
    const arms = crossArms(content.toString())
    const empty = placeBeads(project, plan, part).filter((bead) => bead.color === null)

    expect(empty.length).toBeGreaterThan(0)
    expect(arms).toHaveLength(empty.length * 2)
    const across = Math.abs(arms[0]![2] - arms[0]![0])
    expect(across / (plan.zoom * displayedGrid(project).stepAcross * K)).toBeCloseTo(EMPTY_CROSS_SHARE, 2)
  })

  it('numbers only every 5th row and column, upright, on all four sides, the tens in Helvetica-Bold', () => {
    const { content, plan } = chartOf(schema('loom', 150, 100))
    const numbers = texts(content.toString()).filter((text) => /^\d+$/.test(text.value))
    const values = numbers.map((text) => Number(text.value))

    expect(plan.beadMm).toBeGreaterThanOrEqual(2.2)
    expect(values.every((value) => value % 5 === 0)).toBe(true)
    // Part A's 75 columns: 15 numbers on each of the top and bottom; 100 rows: 20 on each of the left and right.
    expect(numbers).toHaveLength(15 * 2 + 20 * 2)
    expect(numbers.filter((text) => text.value === '10').map((text) => text.font)).toEqual(['F2', 'F2', 'F2', 'F2'])
    expect(numbers.filter((text) => text.value === '5').map((text) => text.font)).toEqual(['F1', 'F1', 'F1', 'F1'])
    // Upright: no text matrix is ever set, so nothing is turned.
    expect(content.toString()).not.toContain(' Tm')
  })

  it('numbers only every 10th row and column under 2.2 mm a bead (ticket 0913)', () => {
    const numbers = texts(chartOf(schema()).content.toString()).filter((text) => /^\d+$/.test(text.value))

    expect(numbers.every((text) => Number(text.value) % 10 === 0)).toBe(true)
    expect(numbers).toHaveLength(10 * 2 + 10 * 2)
    expect(numbers.every((text) => text.size === 6.5)).toBe(true)
  })

  it('draws the pad as an outline with no fill', () => {
    const { content } = chartOf(schema())
    const pdf = content.toString()

    // faint, 0.2 mm
    expect(pdf).toContain('0.659 0.659 0.659 RG\n0.567 w')
    expect(pdf).not.toMatch(/0.969 0.953 0.925 rg/)
  })

  it('draws the cell lines 0.1 mm, every 5th 0.18 mm and every 10th and the edge 0.3 mm', () => {
    const pdf = chartOf(schema()).content.toString()

    expect(pdf).toContain('0.78 0.78 0.78 RG\n0.283 w')
    expect(pdf).toContain('0.522 0.522 0.522 RG\n0.51 w')
    expect(pdf).toContain('0.122 0.122 0.122 RG\n0.85 w')
  })

  it('counts the 5th and 10th from the Schema’s first bead, so on part B of a 150 × 100 they fall at 75, 80, 85 and on', () => {
    const { content, part } = chartOf(schema('loom', 150, 100), 1)

    expect(part.overlapAcross).toBe(2)
    // The ruler on part B starts at column 74 (its overlap).
    const columnNumbers = texts(content.toString()).filter((text) => /^\d+$/.test(text.value) && text.y > 750).map((text) => Number(text.value))
    expect(columnNumbers.sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, index) => 75 + index * 5))
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
    const plan = planPrint(project, undefined, 0, 2)
    const placed = placeBeads(project, plan, plan.parts[0]!)

    expect(placed.filter((bead) => bead.color !== null)).toHaveLength(10 * 16)
    expect(Math.max(...placed.map((bead) => bead.across))).toBe(19)
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
    const plan = planPrint(project, undefined, 0, 2)
    const lettered = plan.parts.flatMap((part) => texts(drawChartParts(project, plan, [part], plan.page.height, LETTERS).content.toString()).filter((text) => /^[A-Z]+$/.test(text.value)))
    // 3 + 6 + 9 dark and 12 White, the overlap's repeats aside: at least each once.
    expect(lettered.filter((text) => text.value === 'B').length).toBeGreaterThanOrEqual(18)
    expect(lettered.filter((text) => text.value === 'A').length).toBeGreaterThanOrEqual(12)
  })

  it('draws each bead turned to its panel as a closed path, the empty ones outlined, and the Seams, with no rulers', () => {
    const project = triangle()
    const { content } = chartOf(project)
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

  // A Triangle is at most 81 beads wide, 2.2 mm a bead whole: its 1.8 mm page is drawn on a 100 × 100's plan.
  it.each<[string, number, () => Project, (() => Project)?]>([
    ['round', 9, () => round(12, 12)],
    ['brick', 9, () => schema('brick', 12, 12)],
    ['peyote', 9, () => schema('peyote', 12, 12)],
    ['Custom frame', 9, () => triangleOf(9)],
    ['round', 1.8, () => round(100, 100)],
    ['brick', 1.8, () => schema('brick', 100, 100)],
    ['peyote', 1.8, () => schema('peyote', 100, 100)],
    ['Custom frame', 1.8, () => triangleOf(50), () => schema('loom', 100, 100)],
  ])('draws a %s chart at %s mm a bead, every painted bead lettered inside its cell', (_, beadMm, make, planned = make) => {
    const project = make()
    const plan = planPrint(planned(), undefined, 0, 2)
    const pdf = plan.parts.map((part) => drawChartParts(project, plan, [part], plan.page.height, LETTERS).content.toString()).join('\n')
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

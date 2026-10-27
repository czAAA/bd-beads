import { describe, expect, it } from 'vitest'
import { createProject, type Project } from '../domain/project'
import { drawChartParts, letterColor, luminance, placeBeads } from './chartVector'
import { planPrint, mm } from './printPlan'

// The PrintChartPage card's Acceptance list, on a 100 × 100 loom Schema with an empty background, White beads and dark
// beads, Letters off.
const DARK = '#1f2a44'
const LETTERS = { '#ffffff': 'A', [DARK]: 'B', '#f2c94c': 'AA' }

function schema(technique: 'loom' | 'peyote' | 'brick' | 'rightAngle' | 'netting' = 'loom', columns = 100, rows = 100, extra: Partial<Project> = {}): Project {
  const base = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  // Dark in the top left 10 × 10, White in the next 5 columns of its first 10 rows, a pale yellow beyond them; the rest empty.
  const beads: Record<number, Record<number, string>> = {}
  for (let row = 0; row < 10; row += 1) {
    beads[row] = {}
    for (let column = 0; column < 10; column += 1) beads[row]![column] = DARK
    for (let column = 10; column < 15; column += 1) beads[row]![column] = '#ffffff'
    beads[row]![15] = '#f2c94c'
  }
  return { ...base, frame: { ...base.frame!, beads }, paletteLetters: LETTERS, letters: false, ...extra }
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

  it('puts a bead at 3 mm, 60 across and 75 down, the pad at 10 mm from the left and 25 mm from the top', () => {
    const { part, pads, plan } = chartOf(schema())

    expect([part.lastAcross - part.firstAcross + 1, part.lastDown - part.firstDown + 1]).toEqual([60, 75])
    expect(pads[0]!.x / mm(1)).toBeCloseTo(10, 5)
    expect(pads[0]!.y / mm(1)).toBeCloseTo(25, 5)
    expect(plan.zoom * 20 / mm(1)).toBeCloseTo(3, 5)
  })

  it('letters every bead, Letters off or on, and no empty position', () => {
    const project = schema()
    const { content, part } = chartOf(project)
    const letters = texts(content.toString()).filter((text) => text.font === 'F2' && /^[A-Z]+$/.test(text.value))
    const painted = 10 * 16 // the 16 columns painted in each of 10 rows, all inside part A

    expect(part.firstAcross).toBe(0)
    expect(letters).toHaveLength(painted)
    expect(new Set(letters.map((text) => text.value))).toEqual(new Set(['A', 'B', 'AA']))
    expect(texts(drawChartParts({ ...project, letters: true }, planPrint(project, undefined, 0, 2), [part], 1754, LETTERS).content.toString()).filter((text) => /^[A-Z]+$/.test(text.value))).toHaveLength(painted)
  })

  it('sets a letter in 6.5 pt, centred across its bead, with its baseline 2.32 mm below the top of the cell', () => {
    const { content } = chartOf(schema())
    const first = texts(content.toString()).find((text) => text.value === 'B')!
    const pointsPerMm = 72 / 25.4

    expect(first.size).toBe(6.5)
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
    expect(luminance('#ffffff')).toBe(1)
    expect([letterColor(DARK), letterColor('#ffffff'), letterColor('#f2c94c'), letterColor('#000000')]).toEqual(['#ffffff', '#1f1f1f', '#1f1f1f', '#ffffff'])
    // The balance point: 0.1791 is where black and white contrast equally.
    expect(luminance('#767676')).toBeLessThan(0.1791 + 0.01)
  })

  it('fills only the painted positions: an empty position is plain paper', () => {
    const { content } = chartOf(schema())
    const fills = content.toString().match(/ re f/g) ?? []

    expect(fills).toHaveLength(10 * 16)
  })

  it('numbers only every 5th row and column, upright, on all four sides, the tens in Helvetica-Bold', () => {
    const { content } = chartOf(schema())
    const numbers = texts(content.toString()).filter((text) => /^\d+$/.test(text.value))
    const values = numbers.map((text) => Number(text.value))

    expect(values.every((value) => value % 5 === 0)).toBe(true)
    // 60 columns: 12 numbers on each of the top and bottom; 75 rows: 15 on each of the left and right.
    expect(numbers).toHaveLength(12 * 2 + 15 * 2)
    expect(numbers.filter((text) => text.value === '10').map((text) => text.font)).toEqual(['F2', 'F2', 'F2', 'F2'])
    expect(numbers.filter((text) => text.value === '5').map((text) => text.font)).toEqual(['F1', 'F1', 'F1', 'F1'])
    // Upright: no text matrix is ever set, so nothing is turned.
    expect(content.toString()).not.toContain(' Tm')
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

  it('counts the 5th and 10th lines from the Schema’s first bead, so on part B they fall after 70, 80 and 90', () => {
    const { content, part } = chartOf(schema(), 1)

    expect(part.overlapAcross).toBe(2)
    // The ruler on part B starts at column 59 (its overlap); a ten falls at 60, 70, 80, 90 and 100.
    const columnNumbers = texts(content.toString()).filter((text) => /^\d+$/.test(text.value) && text.y > 750).map((text) => Number(text.value))
    expect(columnNumbers.sort((a, b) => a - b)).toEqual([60, 65, 70, 75, 80, 85, 90, 95, 100])
  })

  it('tints the overlap 60 % toward white, with muted letters and faint numbers, under an accent line between columns 60 and 61', () => {
    const project = schema('loom', 100, 100, { frame: undefined })
    const painted = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 100, height: 100, unit: 'beads' } })
    const full: Record<number, Record<number, string>> = { 0: Object.fromEntries(Array.from({ length: 100 }, (_, column) => [column, DARK])) }
    const wide: Project = { ...project, frame: { ...painted.frame!, beads: full } }
    const { content } = chartOf(wide, 1)
    const pdf = content.toString()

    // #1f2a44 mixed 60 % toward white; the overlap's two columns carry muted letters, the rest white ones.
    expect(pdf).toContain('0.647 0.667 0.706 rg')
    const letters = texts(pdf).filter((text) => text.value === 'B')
    expect(letters).toHaveLength(42)
    expect(pdf).toContain('0.98 0.322 0.059 RG\n1.417 w')
  })

  it.each(['peyote', 'brick', 'rightAngle', 'netting'] as const)('places and letters every bead of a %s Schema', (technique) => {
    const project = schema(technique, 40, 40)
    const { content } = chartOf(project)
    const letters = texts(content.toString()).filter((text) => text.font === 'F2' && /^[A-Z]+$/.test(text.value))

    expect(letters.length).toBeGreaterThan(0)
    expect(content.toString()).not.toContain('NaN')
  })

  it('places the beads of a turned Schema from the Project renderer', () => {
    const project = schema('loom', 40, 20, { rotation: 90 })
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

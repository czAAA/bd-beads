import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import { withLetters } from '../domain/layerRecord'
import { changeFrame } from '../domain/changeFrame'
import { frameLayoutOf } from '../domain/frameShape'
import { paintAt } from '../testUtils/layers'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { headerMaker, printText } from './printText'
import { frameOf, withFrameSheet, withLayer } from '../domain/layerRecord'
import { withLayers } from '../testUtils/layerFields'

const at = new Date(2026, 8, 26, 14, 32)

function delicaProject(painted: number) {
  const base = createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', name: 'Logo panel', size: { width: 80, height: 60, unit: 'beads' } })
  const cells = Array.from({ length: painted }, (_, index) => ({ row: Math.floor(index / 80), column: index % 80 }))
  return paintAt(base, cells, '#e63746')
}

describe('printText (tickets 162, 164)', () => {
  it('says what the pages print about the Project: technique word, size, bead, estimate, date and time', () => {
    const text = printText(delicaProject(10), en, 'en', at)

    expect(text.techniqueWord).toBe('Loom')
    expect(text.size).toBe('80×60')
    expect(text.metaLine).toMatch(/^80×60 · Miyuki Delica 11\/0 · ≈ .+ cm$/)
    expect(text.exportedAt).toBe('Sep 26, 2026 · 14:32')
    expect(text.maker).toBe('')
  })

  it('writes Beads needed in beads and grams, the Total from the total count, with the note', () => {
    const text = printText(delicaProject(4800), en, 'en', at)

    expect(text.colors).toEqual([{ hex: '#e63746', name: 'Red', beads: '4 800', grams: '24 g', tubes: '6 × 5 g' }])
    expect(text.totalBeads).toBe('4 800 beads')
    expect(text.totalGrams).toBe('24 g')
    expect(text.gramsNote).toBe('≈ 200 Delica 11/0 a gram, rounded up. Buy about 10% more for spares.')
  })

  it('buys tubes per color from its grams, a color under a gram is one, and the Total adds the rows (ticket 0581)', () => {
    const red = delicaProject(4800)
    const project = paintAt(red, [{ row: 59, column: 79 }, { row: 59, column: 78 }], '#2255aa')
    const text = printText(project, en, 'en', at)

    expect(text.colors.map((color) => [color.grams, color.tubes])).toEqual([['24\u00a0g', '6 × 5 g'], ['0.1\u00a0g', '1 × 5 g']])
    expect(text.totalTubes).toBe('7 × 5 g')
  })

  it('has no tubes for an unknown Bead', () => {
    const text = printText(withLayers(delicaProject(10), { beadId: 'a-bead-this-device-never-had', bead: undefined }), en, 'en', at)

    expect(text.colors[0]!.tubes).toBeUndefined()
    expect(text.totalTubes).toBeUndefined()
  })

  it('words the facts and the color count page 1 prints (ticket 580)', () => {
    const text = printText(delicaProject(10), en, 'en', at)

    expect(text).not.toHaveProperty('shape')
    expect(text.colorsCount).toBe('1 color')
  })

  it('shows no grams and no note for a Bead with no weight', () => {
    const text = printText(withLayers(delicaProject(10), { beadId: 'a-bead-this-device-never-had', bead: undefined }), en, 'en', at)

    expect(text.colors[0]!.grams).toBeUndefined()
    expect(text.totalGrams).toBeUndefined()
    expect(text.gramsNote).toBeUndefined()
    expect(text.metaLine).toBe('80×60 · Unknown bead')
  })

  it('speaks Russian: the date, the plural, the decimal comma', () => {
    const text = printText(delicaProject(761), ru, 'ru', at)

    expect(text.exportedAt).toBe('26 сент. 2026 г. · 14:32')
    expect(text.totalBeads).toBe('761 бисеринка')
    expect(text.totalGrams).toBe('3,9 г')
    expect(text.techniqueWord).toBe(ru.techniques.loom)
  })

  it('cuts a long maker name in the header, never a short one', () => {
    expect(headerMaker('Maria')).toBe('Maria')
    expect(headerMaker('x'.repeat(40))).toHaveLength(32)
    expect(headerMaker('x'.repeat(40)).endsWith('…')).toBe(true)
  })

  it("prints the Project's own maker's name (ADR 0060)", () => {
    const project = { ...delicaProject(10), makerName: 'Bead Master' }
    const text = printText(project, en, 'en', at)

    expect(text.maker).toBe('Bead Master')
  })

  it("titles the export with the Frame's name, else the Project's (ticket 0720)", () => {
    const framed = withLayer(delicaProject(10), 'frame', { name: 'Rose' })

    expect(printText(framed, en, 'en', at).name).toBe('Rose')
    expect(printText(delicaProject(10), en, 'en', at).name).toBe('Logo panel')
    expect(printText(withLayer(delicaProject(10), 'frame', { name: '  ' }), en, 'en', at).name).toBe('Logo panel')
  })

  it('prints no name when the Project has none (ADR 0060)', () => {
    const text = printText(delicaProject(10), en, 'en', at)

    expect(text.maker).toBe('')
  })
})

describe('printText with Letters (ticket 0573)', () => {
  it('gives each color of Beads needed its Swatch letter only when Letters is on', () => {
    const project = delicaProject(10)
    expect(printText(project, en, 'en', at).colors.map((color) => color.letter)).toEqual([undefined])
    const lettered = printText(withLetters(project, true), en, 'en', at)
    expect(lettered.colors.map((color) => color.letter)).toEqual([project.paletteLetters!['#e63746']])
  })

  it('calls the chart style what the chart pages print, color with letters, whatever Letters says (ticket 0869)', () => {
    const project = delicaProject(1)
    expect(printText(project, en, 'en', at).chartStyle).toBe('Color + letters')
    expect(printText(withLetters(project, true), en, 'en', at).chartStyle).toBe('Color + letters')
  })
})

describe('printText Word chart (ticket 0574)', () => {
  const letters = (project: ReturnType<typeof delicaProject>) => withLetters({ ...project, paletteLetters: { '#e63746': 'C' } }, true)

  it('writes the rows as words with the range, the notes and the runs', () => {
    const base = createProject({ technique: 'brick', beadId: 'miyuki-delica-11-0', size: { width: 3, height: 2, unit: 'beads' } })
    const painted = paintAt(base, [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 2 }], '#e63746')
    const chart = printText(letters(painted), en, 'en', at).wordChart!

    expect(chart.title).toBe('Row by row')
    expect(chart.notes).toEqual([en.print.wordChart.firstTop, en.print.wordChart.sides, en.print.wordChart.runNote])
    expect(chart.rows).toEqual([
      { label: '1', first: 1, last: 1, marker: 'L', runs: '2C, 1*' },
      { label: '2', first: 2, last: 2, marker: 'R', runs: '1C, 2*' },
    ])
  })

  it('says Rows 1&2 and the count for peyote, and translates the words but not the letters', () => {
    const base = createProject({ technique: 'peyote', beadId: 'miyuki-delica-11-0', size: { width: 4, height: 2, unit: 'beads' } })
    const chart = printText(letters(paintAt(base, [{ row: 0, column: 0 }], '#e63746')), ru, 'ru', at).wordChart!

    expect(chart.rows[0]).toEqual({ label: '1&2', first: 1, last: 2, marker: 'L', runs: '1C, 3*' })
    expect(chart.notes).toContain(ru.print.wordChart.evenCount)
    expect(chart.empty).toBe(ru.print.wordChart.empty)
  })

  it('names a Custom frame\'s round or join before its runs, and says where it starts (ticket 0594)', () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape: 'star', size: 2, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Star')
    const { row, column } = frameOf(placed.project)!
    const painted = paintAt(placed.project, [{ row, column, layer: 'frame' }], '#e63746')
    const chart = printText(letters(painted), en, 'en', at).wordChart!

    expect(chart.notes).toEqual([en.print.wordChart.partsThenJoins, en.print.wordChart.runNote, en.print.wordChart.pairNote])
    expect(chart.rows[0]).toEqual({ label: '1', first: 1, last: 1, runs: 'Part 1, round 1: 1*, 1C, 2*' })
    expect(chart.rows[10]).toEqual({ label: '11', first: 11, last: 11, runs: 'Zip 1–2' })
  })

  it('writes a round side by side, each from its corner pair in brackets, a pair of two colors with both (ticket 0873)', () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape: 'warpedSquare', size: 3, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Warped Square')
    const layout = frameLayoutOf(frameOf(placed.project)!)!
    const { row, column } = frameOf(placed.project)!
    // Round 3's first side's beads, its first pair's second bead among them.
    const cells = layout.positions.filter((position) => position.row === 2 && position.panel === 0).map((position) => ({ row: row + position.row, column: column + position.column, layer: 'frame' as const }))
    expect(cells.length).toBe(3)
    const chart = printText(letters(paintAt(placed.project, cells, '#e63746')), en, 'en', at).wordChart!
    expect(chart.notes).toEqual([en.print.wordChart.firstCentre, en.print.wordChart.runNote, en.print.wordChart.pairNote])
    expect(chart.rows[0]!.runs).toBe('Round 1: 4*')
    expect(chart.rows[1]!.runs).toBe('Round 2: (2*)\u00a0| (2*)\u00a0| (2*)\u00a0| (2*)')
    // A side's mark keeps to the side it ends; a pair of two colors is never split between lines.
    expect(chart.rows[2]!.runs).toBe('Round 3: (1*\u00a01C), 1C\u00a0| (1C\u00a01*), 1*\u00a0| (2*), 1*\u00a0| (2*), 1*')
  })

  it('starts a Fringe earring\'s Word chart at its top\'s base row and names each strand (ticket 0597)', () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const settings = { topWidth: 3, topRows: 2, fringeStyle: 'straight', fringeLength: 2 } as const
    const placed = changeFrame(open, { custom: { shape: 'fringeEarring', settings, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Fringe earring')
    const chart = printText(letters(placed.project), en, 'en', at).wordChart!

    expect(chart.notes).toEqual([en.print.wordChart.firstBase, en.print.wordChart.runNote])
    expect(chart.rows[2]).toEqual({ label: '3', first: 3, last: 3, runs: 'Strand 1: 2*' })
  })

  it('says a Kaleidocycle\'s Word chart is one face of its 24 triangles, each other face a Frame of its own (ticket 0876)', () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape: 'kaleidocycle', size: 3, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Kaleidocycle')
    const chart = printText(letters(placed.project), en, 'en', at).wordChart!

    const face = "This chart is one face: 6 of the Kaleidocycle's 24 triangles. Make a Frame for each other face to chart its design."
    expect(chart.notes).toEqual([en.print.wordChart.partsThenJoins, face, en.print.wordChart.runNote])
  })

  it('has none with Letters off', () => {
    expect(printText(delicaProject(3), en, 'en', at).wordChart).toBeUndefined()
  })
})

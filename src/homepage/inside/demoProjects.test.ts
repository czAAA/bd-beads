import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { frameOf, orientationOf, projectNameOf, weaveOfLayer } from '../../domain/layerRecord'
import { hasProjectBeads } from '../../domain/layerBeads'
import { frameGrid } from '../../testUtils/frameGrid'
import { DEMO_DRAWING, DEMO_FRAME, DEMO_LETTERING, DEMO_MIRROR_BEADS, DEMO_REPEAT_AXES, DEMO_TECHNIQUE, PANORAMA, RIDGE, SUN, demoLibrary, finishedMountains } from './demoProjects'

describe("What's inside's demo Projects (ticket 0797)", () => {
  it('are Ring, the newest, an open peyote Canvas lying across with nothing drawn and no Frame, and Heart and Bracelet', () => {
    const library = demoLibrary(en)
    expect(library.map(projectNameOf)).toEqual(['Bracelet', 'Heart', 'Ring'])
    const ring = library[2]
    expect(Math.max(...library.map((project) => project.updatedAt))).toBe(ring.updatedAt)
    expect(frameOf(ring)).toBeUndefined()
    expect(hasProjectBeads(ring)).toBe(false)
    expect(weaveOfLayer(ring, 'canvas').technique).toBe(DEMO_TECHNIQUE)
    expect(orientationOf(ring)).toBe(0)
    expect(library.slice(0, 2).every((project) => frameOf(project) && hasProjectBeads(project))).toBe(true)
    expect(library.every((project) => project.layers[0].beadId === 'miyuki/delica/11-0')).toBe(true)
  })

  it('are named in the language shown', () => {
    expect(demoLibrary(ru).map(projectNameOf)).toEqual(['Браслет', 'Сердце', 'Кольцо'])
  })

  it("draw the ring's lettering in gold, the size of its Frame", () => {
    const { rows } = DEMO_DRAWING
    expect(rows).toHaveLength(DEMO_FRAME.rows)
    expect(rows.every((row) => row.length === DEMO_FRAME.columns)).toBe(true)
    expect([DEMO_DRAWING.row, DEMO_DRAWING.column]).toEqual([DEMO_FRAME.row, DEMO_FRAME.column])
    expect(new Set(rows.join('').replaceAll('.', ''))).toEqual(new Set(['D']))
  })

  it('write it as a pen would: each stroke of neighbouring beads, no bead written twice, left to right', () => {
    const written = DEMO_LETTERING.flat().map(([row, column]) => `${row},${column}`)
    expect(new Set(written).size).toBe(written.length)
    for (const stroke of DEMO_LETTERING) {
      for (let at = 1; at < stroke.length; at++) {
        const [[up, left], [down, right]] = [stroke[at - 1], stroke[at]]
        expect(Math.max(Math.abs(down - up), Math.abs(right - left)), `${up},${left} to ${down},${right}`).toBe(1)
      }
    }
    // A letter's strokes, its dots last, come before the next letter's.
    const letters = DEMO_LETTERING.map((stroke) => Math.floor(Math.min(...stroke.map(([, column]) => column)) / (DEMO_FRAME.columns / (DEMO_REPEAT_AXES + 1))))
    expect(letters).toEqual([...letters].sort((a, b) => a - b))
  })

  it("repeat with Mirror: the band's strips are whole peyote cycles, and the first strip's beads land on empty beads all round", () => {
    const strips = DEMO_REPEAT_AXES + 1
    const width = DEMO_FRAME.columns / strips
    expect(Number.isInteger(width) && width % 2 === 0).toBe(true)
    const grid = DEMO_DRAWING.rows.map((row) => [...row])
    for (const { beads } of DEMO_MIRROR_BEADS) {
      for (const [row, column] of beads) {
        expect(column).toBeLessThan(width)
        for (let strip = 0; strip < strips; strip++) expect(grid[row][column + strip * width], `${row},${column + strip * width}`).toBe('.')
      }
    }
  })

  it("trace a panorama whose ridge has no gap: next columns a row apart at most, the sun in the sky above it", () => {
    expect(RIDGE).toHaveLength(PANORAMA.columns)
    for (let column = 1; column < RIDGE.length; column++) expect(Math.abs(RIDGE[column] - RIDGE[column - 1])).toBeLessThanOrEqual(1)
    expect(RIDGE.every((row) => row >= 1 && row <= PANORAMA.rows - 3)).toBe(true)
    for (let across = SUN.column; across < SUN.column + SUN.size; across++) expect(SUN.row + SUN.size - 1).toBeLessThan(RIDGE[across])
  })
})

describe("the Welcome section's piece (ticket 0830)", () => {
  const SKY = '#8fb8de'
  const SNOW = '#ffffff'
  const SLOPES = '#9aa0a6'
  const GROUND = '#8a5a3b'
  const SUN_COLOR = '#f2c94c'

  it('is the traced panorama finished: a peyote Frame 36 by 7 lying across, every bead woven', () => {
    const piece = finishedMountains()
    expect(frameOf(piece)).toMatchObject({ rows: 7, columns: 36 })
    expect(weaveOfLayer(piece, 'frame')?.technique).toBe('peyote')
    expect(orientationOf(piece)).toBe(0)
    const colors = frameGrid(piece).flat().map((cell) => cell.color)
    expect(colors).toHaveLength(7 * 36)
    expect(new Set(colors)).toEqual(new Set([SKY, SNOW, SLOPES, GROUND, SUN_COLOR]))
  })

  it('has sky over the snow line, slopes under it, the ground along the foot and the sun in the sky', () => {
    const grid = frameGrid(finishedMountains())
    const column = (at: number) => grid.map((row) => row[at]!.color)
    // The second peak's left side: the ridge at row 1, stepping down to row 2 in the next column.
    expect(column(5)).toEqual([SKY, SNOW, SNOW, SLOPES, SLOPES, SLOPES, GROUND])
    // A valley: the ridge at row 4 on both sides.
    expect(column(20)).toEqual([SKY, SKY, SKY, SKY, SNOW, SLOPES, GROUND])
    expect([grid[0]![29]!.color, grid[0]![30]!.color, grid[1]![29]!.color, grid[1]![30]!.color]).toEqual([SUN_COLOR, SUN_COLOR, SUN_COLOR, SUN_COLOR])
    // No flowers: the tour paints those later.
    expect(grid[5]![6]!.color).toBe(SLOPES)
  })
})

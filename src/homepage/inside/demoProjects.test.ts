import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { frameOf, orientationOf, projectNameOf, weaveOfLayer } from '../../domain/layerRecord'
import { hasProjectBeads } from '../../domain/layerBeads'
import { projectPalette } from '../../domain/palette'
import { frameGrid } from '../../testUtils/frameGrid'
import { DEMO_CUFF, DEMO_CUFF_AXES, DEMO_EDIT_BEADS, DEMO_FIRST_STRIP, DEMO_FRAME, DEMO_MIRROR_STRIP, DEMO_RING_AXES, DEMO_TECHNIQUE, demoLibrary, finishedCuff, onCanvas } from './demoProjects'
import { PEACOCK_RING } from './peacock'

describe("What's inside's demo Projects (ticket 0797)", () => {
  it('are Ring, the newest, an open peyote Canvas with nothing drawn and no Frame, turned as a new peyote Project is, and Heart and Bracelet', () => {
    const library = demoLibrary(en)
    expect(library.map(projectNameOf)).toEqual(['Bracelet', 'Heart', 'Ring'])
    const ring = library[2]
    expect(Math.max(...library.map((project) => project.updatedAt))).toBe(ring.updatedAt)
    expect(frameOf(ring)).toBeUndefined()
    expect(hasProjectBeads(ring)).toBe(false)
    expect(weaveOfLayer(ring, 'canvas').technique).toBe(DEMO_TECHNIQUE)
    expect(orientationOf(ring)).toBe(90)
    expect(library.slice(0, 2).every((project) => frameOf(project) && hasProjectBeads(project))).toBe(true)
    expect(library.every((project) => project.layers[0].beadId === 'miyuki/delica/11-0')).toBe(true)
  })

  it("give Ring's Palette the peacock's teal, deep blue and deep green beside Miyuki's own colors (ticket 0831)", () => {
    const ring = demoLibrary(en)[2]
    const palette = projectPalette(ring).colors.map((color) => color.hex.toLowerCase())
    for (const color of ['#17c3c9', '#1c1f6e', '#0c4a3a']) expect(palette, color).toContain(color)
  })

  it('are named in the language shown', () => {
    expect(demoLibrary(ru).map(projectNameOf)).toEqual(['Браслет', 'Сердце', 'Кольцо'])
  })


  it('lay a ring band 36 long and 7 wide, then a cuff 48 by 23 round the same middle, both from an even column (ticket 0831)', () => {
    expect(DEMO_FRAME).toEqual({ row: 10, column: 12, rows: 36, columns: 7 })
    expect(DEMO_CUFF).toEqual({ row: 4, column: 4, rows: 48, columns: 23 })
    expect(DEMO_FRAME.row + DEMO_FRAME.rows / 2).toBe(DEMO_CUFF.row + DEMO_CUFF.rows / 2)
    expect(DEMO_FRAME.column + (DEMO_FRAME.columns - 1) / 2).toBe(DEMO_CUFF.column + (DEMO_CUFF.columns - 1) / 2)
    expect(onCanvas(DEMO_FRAME, 2, 5)).toEqual({ row: 15, column: 14 })
  })

  it('repeat an eye in 4 strips of the ring and 3 of the cuff, the first two eyes drawn in the strips at the left', () => {
    expect([DEMO_RING_AXES, DEMO_CUFF_AXES]).toEqual([3, 2])
    expect([DEMO_FIRST_STRIP, DEMO_MIRROR_STRIP]).toEqual([3, 2])
  })

  it("put Project editing's three gold beads on the ground between the first two eyes", () => {
    expect(DEMO_EDIT_BEADS).toHaveLength(3)
    for (const [line, along] of DEMO_EDIT_BEADS) expect(PEACOCK_RING.rows[line]![along], `${line},${along}`).toBe('.')
  })
})

describe("the Welcome section's piece (ticket 0831)", () => {
  const [GREEN, GOLD, TEAL, BLUE, PUPIL, GROUND] = ['#27ae60', '#d4af37', '#17c3c9', '#2f6fed', '#1c1f6e', '#0c4a3a']

  it('is the traced cuff finished: a peyote Frame 48 long and 23 wide on a turned Canvas, every bead woven', () => {
    const piece = finishedCuff()
    expect(frameOf(piece)).toMatchObject({ rows: 48, columns: 23 })
    expect(weaveOfLayer(piece, 'frame')?.technique).toBe('peyote')
    expect(orientationOf(piece)).toBe(90)
    const colors = frameGrid(piece).flat().map((cell) => cell.color)
    expect(colors).toHaveLength(48 * 23)
    expect(new Set(colors)).toEqual(new Set([GREEN, GOLD, TEAL, BLUE, PUPIL, GROUND]))
  })

  it('has three eyes alike, each ringed green, gold, teal and blue round a deep blue pupil, with no purple yet', () => {
    const grid = frameGrid(finishedCuff())
    const along = (line: number, from: number) => grid.slice(from, from + 16).map((row) => row[line]!.color)
    const middle = [GREEN, GREEN, GOLD, TEAL, TEAL, BLUE, BLUE, PUPIL, PUPIL, BLUE, BLUE, TEAL, TEAL, GOLD, GREEN, GREEN]
    for (const eye of [0, 16, 32]) expect(along(12, eye)).toEqual(middle)
    expect(grid.flat().filter((cell) => cell.color === GROUND), 'the ground: 105 beads an eye').toHaveLength(315)
  })
})

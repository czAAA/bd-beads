import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { frameOf, projectNameOf } from '../../domain/layerRecord'
import { hasProjectBeads } from '../../domain/layerBeads'
import { DEMO_DRAWING, DEMO_FRAME, DEMO_MIRROR_BEADS, demoLibrary } from './demoProjects'

describe("What's inside's demo Projects (ticket 0797)", () => {
  it('are Kaleidoscope, the newest, an open Canvas with nothing drawn and no Frame, and Heart and Bracelet', () => {
    const library = demoLibrary(en)
    expect(library.map(projectNameOf)).toEqual(['Bracelet', 'Heart', 'Kaleidoscope'])
    const kaleidoscope = library[2]
    expect(Math.max(...library.map((project) => project.updatedAt))).toBe(kaleidoscope.updatedAt)
    expect(frameOf(kaleidoscope)).toBeUndefined()
    expect(hasProjectBeads(kaleidoscope)).toBe(false)
    expect(library.slice(0, 2).every((project) => frameOf(project) && hasProjectBeads(project))).toBe(true)
    expect(library.every((project) => project.layers[0].beadId === 'miyuki/delica/11-0')).toBe(true)
  })

  it('are named in the language shown', () => {
    expect(demoLibrary(ru).map(projectNameOf)).toEqual(['Браслет', 'Сердце', 'Калейдоскоп'])
  })

  it('draw one kaleidoscope the size of the 11 × 11 Frame in three colors, the same turned any quarter or mirrored', () => {
    const { rows } = DEMO_DRAWING
    expect(rows).toHaveLength(DEMO_FRAME.rows)
    expect(rows.every((row) => row.length === DEMO_FRAME.columns)).toBe(true)
    expect([DEMO_DRAWING.row, DEMO_DRAWING.column]).toEqual([DEMO_FRAME.row, DEMO_FRAME.column])
    expect(new Set(rows.join('').replaceAll('.', ''))).toEqual(new Set(['R', 'Y', 'B']))
    expect(mirrored(rows)).toEqual(rows)
    expect(turned(rows)).toEqual(rows)
  })

  it("complete it with Mirror: Radial's four folds on a loom Frame repeat each bead eightfold onto empty beads, still a kaleidoscope", () => {
    const last = DEMO_FRAME.columns - 1
    const grid = DEMO_DRAWING.rows.map((row) => [...row])
    for (const { color, beads } of DEMO_MIRROR_BEADS) {
      for (const [row, column] of beads) {
        // Its quarter turns, and its reflection's (mirror.ts, the eightfold kaleidoscope).
        const images = new Set<string>()
        for (let [down, across] of [[row, column], [row, last - column]]) {
          for (let fold = 0; fold < 4; fold++) {
            images.add(`${down},${across}`)
            ;[down, across] = [across, last - down]
          }
        }
        expect(images.size, `${color} at ${row},${column} is on no fold's line`).toBe(8)
        for (const image of images) {
          const [down, across] = image.split(',').map(Number)
          expect(grid[down][across], `${color} at ${image}`).toBe('.')
          grid[down][across] = color
        }
      }
    }
    const done = grid.map((row) => row.join(''))
    expect(mirrored(done)).toEqual(done)
    expect(turned(done)).toEqual(done)
  })
})

/** The drawing mirrored left to right. */
function mirrored(rows: readonly string[]): string[] {
  return rows.map((row) => [...row].reverse().join(''))
}

/** The drawing flipped over its diagonal. */
function turned(rows: readonly string[]): string[] {
  return rows.map((_, down) => rows.map((row) => row[down]).join(''))
}

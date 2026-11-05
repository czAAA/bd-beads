import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { frameOf, projectNameOf } from '../../domain/layerRecord'
import { hasProjectBeads } from '../../domain/layerBeads'
import { DEMO_DRAWINGS, DEMO_FRAME, demoLibrary } from './demoProjects'

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

  it('draw a kaleidoscope the size of the 11 × 11 Frame, the same turned any quarter or mirrored', () => {
    const [middle] = DEMO_DRAWINGS
    expect(middle.rows).toHaveLength(DEMO_FRAME.rows)
    expect(middle.rows.every((row) => row.length === DEMO_FRAME.columns)).toBe(true)
    expect([middle.row, middle.column]).toEqual([DEMO_FRAME.row, DEMO_FRAME.column])
    const mirrored = middle.rows.map((row) => [...row].reverse().join(''))
    const turned = middle.rows.map((_, down) => middle.rows.map((row) => row[down]).join(''))
    expect(mirrored).toEqual(middle.rows)
    expect(turned).toEqual(middle.rows)
  })

  it('put the rhombus on its left and the flower on its right, from the Frame\'s first bead', () => {
    const [, rhombus, flower] = DEMO_DRAWINGS
    expect([rhombus.row - DEMO_FRAME.row, rhombus.column - DEMO_FRAME.column]).toEqual([3, -21])
    expect(rhombus.rows).toEqual(['..P..', '.PPP.', 'PPYPP', '.PPP.', '..P..'])
    expect([flower.row - DEMO_FRAME.row, flower.column - DEMO_FRAME.column]).toEqual([1, 27])
    expect(flower.rows).toEqual(['.RRR.', 'RRYRR', '.RRR.', '..G..', 'G.G..', '.GG.G', '..GG.', '..G..'])
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import type { Cell, Project } from './project'
import { BEAD_CATALOG } from './beads'
import type { Technique } from './weave'
import { fillAt } from '../testUtils/layers'
import { frameGrid, withFrameGrid } from '../testUtils/frameGrid'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

describe('fillArea', () => {
  function makeGridProject(technique: Technique, grid: Cell[][]): Project {
    const base = createProject({
      technique,
      beadId: cubeBead.id,
      size: { width: grid[0]!.length * 1.5, height: grid.length * 1.5, unit: 'mm' },
    })
    return withFrameGrid(base, grid)
  }

  it('repaints every cell of the clicked color reachable through same-colored neighbors', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'blue' }, { color: 'blue' }, { color: 'blue' }],
    ])

    const filled = fillAt(project, 0, 0, 'green')

    expect(frameGrid(filled)[0]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(frameGrid(filled)[1]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(frameGrid(filled)[2]!.map((c) => c.color)).toEqual(['blue', 'blue', 'blue'])
  })

  it('does not spill across a differently-colored boundary', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'blue' }],
    ])

    const filled = fillAt(project, 0, 0, 'green')

    expect(frameGrid(filled)[0]![1]!.color).toBe('blue')
    expect(frameGrid(filled)[1]![1]!.color).toBe('blue')
  })

  it('returns the same project instance, unchanged, when the clicked cell already has the fill color', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    expect(fillAt(project, 0, 0, 'red')).toBe(project)
  })

  it('does not mutate the original project', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    fillAt(project, 0, 0, 'green')

    expect(frameGrid(project)[0]![0]!.color).toBe('red')
  })

  it("connects a diagonally-offset same-color cell for Peyote that a straight Loom grid would not", () => {
    const grid: Cell[][] = [
      [{ color: null }, { color: 'red' }],
      [{ color: 'red' }, { color: null }],
    ]

    const loomFilled = fillAt(makeGridProject('loom', grid), 0, 1, 'green')
    const peyoteFilled = fillAt(makeGridProject('peyote', grid), 0, 1, 'green')

    // Loom: (0,1)'s only straight neighbor below is (1,1), which is unpainted, so (1,0) stays red.
    expect(frameGrid(loomFilled)[1]![0]!.color).toBe('red')
    // Peyote: row 1 is shifted right, so (0,1) overlaps (1,0) and (1,1) below it, reaching the red cell.
    expect(frameGrid(peyoteFilled)[1]![0]!.color).toBe('green')
  })
})

import { describe, expect, it } from 'vitest'
import { withColors, type BeadChange } from './canvas'
import { createProject } from './createProject'
import { projectPalette } from './palette'
import { withPieceName } from './pieceNames'
import type { Project } from './project'
import { schemaDetails, unframedSchemas } from './schemaTags'
import { withLayers } from '../testUtils/layerFields'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const [first, second, third] = projectPalette(base).colors.map((color) => color.hex)
const OUTSIDE = '#123456'
const row = (r: number, from: number, to: number, color = first): BeadChange[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ row: r, column: from + i, color }))
const projectWith = (...rows: BeadChange[][]): Project => withLayers(base, { beads: withColors({}, rows.flat()) })

describe('the unframed Schemas', () => {
  it('lists each named Piece with the bead its name is kept on, and no plain Piece', () => {
    const project = withPieceName(projectWith(row(4, 2, 5), row(9, 0, 1)), { row: 4, column: 3 }, 'Owl')

    expect(unframedSchemas(project)).toEqual([{ name: 'Owl', anchor: { row: 4, column: 3 }, row: 4, column: 2, rows: 1, columns: 4, beads: 4 }])
  })

  it('leaves out a named Piece the Frame wholly hides, and keeps one beside it', () => {
    const named = withPieceName(withPieceName(projectWith(row(1, 0, 2), row(10, 10, 12)), { row: 1, column: 0 }, 'Hidden'), { row: 10, column: 10 }, 'Sketch')
    const framed = withLayers(named, { frame: { technique: 'loom', row: 0, column: 0, rows: 3, columns: 3, beads: {} } })

    expect(unframedSchemas(framed).map((schema) => schema.name)).toEqual(['Sketch'])
  })
})

describe('a Schema\'s details (the paper tag)', () => {
  it('counts its size, its beads and its colors in the Palette\'s order, a color from outside the Palette last', () => {
    const project = withPieceName(projectWith(row(0, 0, 2, OUTSIDE), row(1, 0, 3, third), row(2, 0, 0, first), row(2, 1, 1, third)), { row: 0, column: 0 }, 'Owl')

    expect(schemaDetails(project, { row: 0, column: 0 })).toMatchObject({ columns: 4, rows: 3, beads: 9, colors: [first, third, OUTSIDE] })
  })

  it('measures it with the Canvas\'s Bead, as the Frame panel works out the Estimated size', () => {
    const project = withPieceName(projectWith(row(0, 0, 9, second)), { row: 0, column: 0 }, 'Owl')

    expect(schemaDetails(project, { row: 0, column: 0 })?.sizeMm).toEqual({ widthMm: 15, heightMm: 1.5 })
  })

  it('has none where no bead stands', () => {
    expect(schemaDetails(projectWith(row(0, 0, 2)), { row: 5, column: 5 })).toBeUndefined()
  })
})

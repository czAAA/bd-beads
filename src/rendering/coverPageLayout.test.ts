import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { COVER_PAD, coverPageLayout } from './coverPageLayout'
import { A4_PORTRAIT, displayedGrid, mm, PRINT_MARGIN } from './printPlan'
import { bareProject } from '../testUtils/layerFields'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => bareProject({ technique, orientation: rotation, beads: {}, frame: { technique, row: 0, column: 0, columns, rows, beads: {} } })

// The Cover page's board and piece (ticket 1096; PrintCover card).
describe('coverPageLayout', () => {
  it('puts the board at its top, under the title block, as wide as the page allows inside the margins and 196 mm tall', () => {
    expect(coverPageLayout(shape('loom', 20, 20), A4_PORTRAIT, mm(70)).board).toEqual({ x: PRINT_MARGIN, y: mm(70), width: A4_PORTRAIT.width - PRINT_MARGIN * 2, height: mm(196) })
  })

  it.each([
    ['a long cuff', 120, 24, 0],
    ['a tall strip', 15, 200, 0],
    ['a 5 × 5 with no largest bead', 5, 5, 0],
    ['a cuff turned a quarter', 120, 24, 90],
  ] as const)('fills the board inside its 8 mm pad and centres %s', (_name, columns, rows, rotation) => {
    const { board, piece } = coverPageLayout(shape('loom', columns, rows, rotation))
    const left = piece.x - board.x
    const top = piece.y - board.y

    expect(Math.min(left, top)).toBeCloseTo(COVER_PAD, 6)
    expect(board.x + board.width - (piece.x + piece.width)).toBeCloseTo(left, 6)
    expect(board.y + board.height - (piece.y + piece.height)).toBeCloseTo(top, 6)
  })

  it('lays a cuff across as its Canvas is turned', () => {
    const across = coverPageLayout(shape('loom', 120, 24)).piece
    const turned = coverPageLayout(shape('loom', 120, 24, 90)).piece

    expect(across.width).toBeGreaterThan(across.height)
    expect(turned.height).toBeGreaterThan(turned.width)
  })

  it('trims the piece to its beads before it scales it, and draws from where the beads start (ticket 1128)', () => {
    const beads = { 4: { 8: '#ff0000', 20: '#ff0000' }, 33: { 8: '#ff0000', 20: '#ff0000' } }
    const piece = bareProject({ technique: 'loom', orientation: 0, beads: {}, frame: { technique: 'loom', row: 0, column: 0, columns: 30, rows: 39, beads } })
    const trimmed = coverPageLayout(piece)
    const { stepAcross, stepDown } = displayedGrid(piece)

    expect(trimmed.zoom).toBeCloseTo(coverPageLayout(shape('loom', 13, 30)).zoom, 9)
    expect(trimmed.piece).toEqual(coverPageLayout(shape('loom', 13, 30)).piece)
    expect(trimmed.start).toEqual({ x: 8 * stepAcross, y: 4 * stepDown })
    expect(coverPageLayout(shape('loom', 30, 39)).start).toEqual({ x: 0, y: 0 })
  })
})

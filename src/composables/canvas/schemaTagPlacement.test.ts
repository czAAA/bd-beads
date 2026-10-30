import { describe, expect, it } from 'vitest'
import { cardPlacement, tagPlacement } from './schemaTagPlacement'

const viewport = { width: 800, height: 600 }
/** A Piece's box on screen, outset included: its bottom-right corner at (300, 200). */
const piece = { left: 200, top: 100, width: 100, height: 100 }

describe('where a Schema\'s tag hangs (SchemaTag card)', () => {
  it('hangs from the bottom-right corner, its hole 9px right and 24px down', () => {
    expect(tagPlacement(piece, viewport, 40)).toEqual({ side: 'right', corner: { x: 300, y: 200 }, hole: { x: 309, y: 224 } })
  })

  it('hangs from the bottom-left corner where it would cross the canvas box\'s right edge', () => {
    const atEdge = { ...piece, left: 680, width: 100 }

    expect(tagPlacement(atEdge, viewport, 40)).toEqual({ side: 'left', corner: { x: 680, y: 200 }, hole: { x: 671, y: 224 } })
  })

  it('shows no tag while the Piece\'s corner is out of view', () => {
    expect(tagPlacement({ ...piece, top: 600 }, viewport, 40)).toBeUndefined()
    expect(tagPlacement({ ...piece, left: -150 }, viewport, 40)).toBeUndefined()
  })
})

describe('where the paper tag opens', () => {
  const tag = tagPlacement(piece, viewport, 40)!

  it('opens below the Piece, hanging by its hole 18px in from its top-right corner', () => {
    expect(cardPlacement(tag, piece, viewport, 160)).toEqual({ above: false, left: 91, top: 206, hole: { x: 309, y: 224 } })
  })

  it('opens above the Piece where there is no room below', () => {
    const low = { ...piece, top: 400 }

    expect(cardPlacement(tagPlacement(low, viewport, 40)!, low, viewport, 160)).toEqual({ above: true, left: 91, top: 234, hole: { x: 309, y: 252 } })
  })

  it('stays inside the canvas box, the hole moving with it', () => {
    const left = { ...piece, left: 0, width: 60 }

    expect(cardPlacement(tagPlacement(left, viewport, 40)!, left, viewport, 160)).toMatchObject({ left: 8, hole: { x: 226 } })
  })
})

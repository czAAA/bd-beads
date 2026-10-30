import { describe, expect, it } from 'vitest'
import { cardPlacement, tagPlacement } from './schemaTagPlacement'

const viewport = { width: 800, height: 600 }
/** A Piece's box on screen, outset included: its top-left corner at (200, 100). */
const piece = { left: 200, top: 100, width: 100, height: 100 }

describe('where a Schema\'s tag sits (SchemaTag card)', () => {
  it('stands above the Piece\'s top-left corner, 4px over its box', () => {
    expect(tagPlacement(piece, viewport)).toEqual({ left: 200, top: 68 })
  })

  it('stays on the top-left corner at the canvas box\'s edge, never flipping to another corner', () => {
    expect(tagPlacement({ ...piece, left: 760 }, viewport)).toEqual({ left: 760, top: 68 })
    expect(tagPlacement({ ...piece, top: 10 }, viewport)).toEqual({ left: 200, top: -22 })
  })

  it('shows no tag while neither the Piece nor its tag is in view', () => {
    expect(tagPlacement({ ...piece, top: 632 }, viewport)).toBeUndefined()
    expect(tagPlacement({ ...piece, top: 600 }, viewport)).toEqual({ left: 200, top: 568 })
    expect(tagPlacement({ ...piece, top: -140 }, viewport)).toBeUndefined()
    expect(tagPlacement({ ...piece, left: 800 }, viewport)).toBeUndefined()
    expect(tagPlacement({ ...piece, left: -200, width: 10 }, viewport)).toBeUndefined()
  })

  it('shows the tag while only part of the Piece is in view', () => {
    expect(tagPlacement({ ...piece, left: -150, width: 200 }, viewport)).toEqual({ left: -150, top: 68 })
  })
})

describe('where the paper tag opens', () => {
  const tag = tagPlacement(piece, viewport)!

  it('opens in the tag\'s place, down over the Piece', () => {
    expect(cardPlacement(tag, viewport, 160)).toEqual({ above: false, left: 200, top: 68 })
  })

  it('opens upwards from the tag\'s foot where there is no room below', () => {
    const low = tagPlacement({ ...piece, top: 500 }, viewport)!

    expect(cardPlacement(low, viewport, 160)).toEqual({ above: true, left: 200, top: 336 })
  })

  it('stays inside the canvas box', () => {
    expect(cardPlacement(tagPlacement({ ...piece, left: 700 }, viewport)!, viewport, 160)).toMatchObject({ left: 556 })
    expect(cardPlacement(tagPlacement({ ...piece, top: 10 }, viewport)!, viewport, 160)).toMatchObject({ top: 8 })
  })
})

import { describe, expect, it } from 'vitest'
import { liftFlatWeave, renamedBrickBlock, renamedBrickBlocks } from './flatWeave'

describe('the flat Brick block of an earlier stored version (tickets 0627, 0636, 0691)', () => {
  it('moves each layer\'s flat Brick block into its settings map as brick stitch\'s Drop, where it wins, keeping the map\'s other settings', () => {
    const stored = {
      technique: 'brick' as const,
      brickBlock: 3,
      techniqueSettings: { brickBlock: 2, rounds: 4 },
      frame: { row: 2, technique: 'brick' as const, brickBlock: 5 },
    }

    expect(liftFlatWeave(stored)).toEqual({
      technique: 'brick',
      techniqueSettings: { brickDrop: 3, rounds: 4 },
      frame: { row: 2, technique: 'brick', techniqueSettings: { brickDrop: 5 } },
    })
  })

  it('reads a Brick block kept in the settings map (file version 11) as brick stitch\'s Drop', () => {
    const stored = { technique: 'brick' as const, techniqueSettings: { brickBlock: 3 }, frame: { technique: 'peyote' as const, techniqueSettings: { brickBlock: 2 } } }

    expect(liftFlatWeave(stored)).toEqual({ technique: 'brick', techniqueSettings: { brickDrop: 3 }, frame: { technique: 'peyote', techniqueSettings: { brickDrop: 2 } } })
  })

  it('leaves a layer with no Brick block, or an unreadable flat one, with the map it has', () => {
    expect(liftFlatWeave({ technique: 'brick' as const, techniqueSettings: { rounds: 4 } })).toEqual({ technique: 'brick', techniqueSettings: { rounds: 4 } })
    expect(liftFlatWeave({ technique: 'brick' as const, brickBlock: 2.5 })).toEqual({ technique: 'brick' })
  })
})

describe('the Brick block of a layer saved before Drop (file version 12, library 5; ticket 0691)', () => {
  it('reads it as brick stitch\'s Drop, keeping the map\'s other settings', () => {
    expect(renamedBrickBlock({ technique: 'brick' as const, techniqueSettings: { brickBlock: 3, rounds: 4 } })).toEqual({ technique: 'brick', techniqueSettings: { brickDrop: 3, rounds: 4 } })
  })

  it('leaves a layer without one as it is', () => {
    const layer = { technique: 'peyote' as const, techniqueSettings: { rounds: 4 } }

    expect(renamedBrickBlock(layer)).toBe(layer)
  })

  it('renames a file version 11 Project\'s maps, the Frame\'s too, and reads no flat field', () => {
    const stored = { technique: 'brick' as const, brickBlock: 5, techniqueSettings: { brickBlock: 3 }, frame: { technique: 'peyote' as const, techniqueSettings: { brickBlock: 2 } } }

    expect(renamedBrickBlocks(stored)).toMatchObject({ techniqueSettings: { brickDrop: 3 }, frame: { techniqueSettings: { brickDrop: 2 } } })
  })
})

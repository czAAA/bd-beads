import { describe, expect, it } from 'vitest'
import { liftFlatWeave } from './flatWeave'

describe('the flat Brick block of an earlier stored version (tickets 0627, 0636)', () => {
  it('moves each layer\'s flat Brick block into its settings map, where it wins, keeping the map\'s other settings', () => {
    const stored = {
      technique: 'brick' as const,
      brickBlock: 3,
      techniqueSettings: { brickBlock: 2, rounds: 4 },
      frame: { row: 2, technique: 'brick' as const, brickBlock: 5 },
    }

    expect(liftFlatWeave(stored)).toEqual({
      technique: 'brick',
      techniqueSettings: { brickBlock: 3, rounds: 4 },
      frame: { row: 2, technique: 'brick', techniqueSettings: { brickBlock: 5 } },
    })
  })

  it('leaves a layer with no flat Brick block, or an unreadable one, with the map it has', () => {
    expect(liftFlatWeave({ technique: 'brick' as const, techniqueSettings: { rounds: 4 } })).toEqual({ technique: 'brick', techniqueSettings: { rounds: 4 } })
    expect(liftFlatWeave({ technique: 'brick' as const, brickBlock: 2.5 })).toEqual({ technique: 'brick' })
  })
})

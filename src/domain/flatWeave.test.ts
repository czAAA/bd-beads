import { describe, expect, it } from 'vitest'
import { flattened, storedSettings, unflattened } from './flatWeave'

describe('the flat Weave fields a file stores (ticket 0627, until ticket 0636)', () => {
  it('stores the Brick block and Net size flat, and a setting it does not name in a map, read back the same', () => {
    const layer = { technique: 'brick' as const, row: 2, techniqueSettings: { brickBlock: 3, netSize: 5, rounds: 4 } }

    const stored = flattened(layer)

    expect(stored).toEqual({ technique: 'brick', row: 2, brickBlock: 3, netSize: 5, techniqueSettings: { rounds: 4 } })
    expect(storedSettings(stored)).toEqual(layer.techniqueSettings)
    expect(unflattened(stored)).toEqual({ technique: 'brick', row: 2 })
  })

  it('leaves out a Brick block of 1 and a map with nothing left in it, as files always have', () => {
    expect(flattened({ technique: 'brick', techniqueSettings: { brickBlock: 1 } })).toEqual({ technique: 'brick' })
    expect(flattened({ technique: 'loom' })).toEqual({ technique: 'loom' })
  })
})

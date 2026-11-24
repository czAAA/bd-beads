import { describe, expect, it } from 'vitest'
import { withColors } from '../../domain/canvas'
import { findBead } from '../../domain/beads'
import { withLayer } from '../../domain/layerRecord'
import { firstOf, SECOND, twoFrames } from '../../testUtils/twoFrames'
import { useBeadsNeeded } from './useBeadsNeeded'

const RED = '#ff0000'

describe('useBeadsNeeded names its Frame (ticket 1218)', () => {
  // The second Frame holds two beads in a Bead of its own; the first holds one.
  const delica = findBead('miyuki/delica/11-0')!
  const two = twoFrames()
  const second = withLayer(two, SECOND, { bead: delica, beads: withColors({}, [{ row: 0, column: 0, color: RED }, { row: 1, column: 1, color: RED }]) })
  const project = withLayer(second, firstOf(two), { beads: withColors({}, [{ row: 0, column: 0, color: RED }]) })

  it('counts the Frame it is given, in that Frame\'s Bead', () => {
    const needed = useBeadsNeeded(() => project, () => SECOND)
    expect(needed.count.value).toBe(2)
    expect(needed.beadName.value).toContain('Delica')
    expect(useBeadsNeeded(() => project).count.value).toBe(1)
  })
})

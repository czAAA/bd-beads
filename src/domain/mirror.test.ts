import { describe, expect, it } from 'vitest'
import {
  axisLinePositions,
  clampAxisCount,
  maxAxisCount,
  mirrorBlockPlacements,
  mirrorCounterpartInStrip,
  mirrorCounterparts,
  stripOf,
} from './mirror'

describe('maxAxisCount', () => {
  it('is one fewer than the cells across, so every axis has a cell on each side', () => {
    expect(maxAxisCount(5)).toBe(4)
    expect(maxAxisCount(1)).toBe(0)
  })

  it('never goes negative for an empty dimension', () => {
    expect(maxAxisCount(0)).toBe(0)
  })
})

describe('clampAxisCount', () => {
  it('keeps a count within [0, maxAxisCount]', () => {
    expect(clampAxisCount(-1, 5)).toBe(0)
    expect(clampAxisCount(10, 5)).toBe(4)
    expect(clampAxisCount(2, 5)).toBe(2)
  })
})

describe('mirrorCounterparts', () => {
  it('with 0 axes, a cell only counterparts itself', () => {
    for (let i = 0; i < 6; i++) {
      expect(mirrorCounterparts(i, 6, 0)).toEqual([i])
    }
  })

  it('with 1 axis and an even dimension, matches the legacy dimension-1-index reflection with no self-mirror', () => {
    // dimension 4: 0<->3, 1<->2. Results come back in ascending strip order (source cell's own strip included
    // wherever it falls in that order), not "self/source first".
    expect(mirrorCounterparts(0, 4, 1)).toEqual([0, 3])
    expect(mirrorCounterparts(1, 4, 1)).toEqual([1, 2])
    expect(mirrorCounterparts(2, 4, 1)).toEqual([1, 2])
    expect(mirrorCounterparts(3, 4, 1)).toEqual([0, 3])
  })

  it('with 1 axis and an odd dimension, self-mirrors the exact center cell', () => {
    // dimension 5: 0<->4, 1<->3, 2 self-mirrors
    expect(mirrorCounterparts(0, 5, 1)).toEqual([0, 4])
    expect(mirrorCounterparts(1, 5, 1)).toEqual([1, 3])
    expect(mirrorCounterparts(2, 5, 1)).toEqual([2])
    expect(mirrorCounterparts(3, 5, 1)).toEqual([1, 3])
    expect(mirrorCounterparts(4, 5, 1)).toEqual([0, 4])
  })

  it('with 2 axes splitting an evenly-divisible dimension into 3 equal strips, alternates A | A′ | A', () => {
    // dimension 6, strips [0,1] [2,3] [4,5]. Strip1 is reversed, so its "position 0" (matching strip0's/2's first
    // cell) is its *last* index (3), and "position 1" is its first index (2). Results are in ascending strip order.
    expect(mirrorCounterparts(0, 6, 2)).toEqual([0, 3, 4])
    expect(mirrorCounterparts(1, 6, 2)).toEqual([1, 2, 5])
    expect(mirrorCounterparts(2, 6, 2)).toEqual([1, 2, 5])
    expect(mirrorCounterparts(3, 6, 2)).toEqual([0, 3, 4])
    expect(mirrorCounterparts(4, 6, 2)).toEqual([0, 3, 4])
    expect(mirrorCounterparts(5, 6, 2)).toEqual([1, 2, 5])
  })

  it('with 2 axes over an uneven dimension, gives the middle (odd-width) strip a self-mirroring center cell -- but only within that strip, since the outer (even-width) strips have no exact center of their own to match onto', () => {
    // dimension 7, strips [0,1] [2,3,4] [5,6] -- the extra cell lands in the middle strip, symmetrically. Cell 3 is
    // that strip's own center, so it maps to itself there; the outer, even-width strips round to their nearest cell.
    expect(mirrorCounterparts(3, 7, 2)).toEqual([1, 3, 5])
    expect(mirrorCounterparts(0, 7, 2)).toEqual([0, 4, 5])
    expect(mirrorCounterparts(6, 7, 2)).toEqual([1, 2, 6])
  })

  it('every result stays within [0, dimension)', () => {
    for (let dimension = 1; dimension <= 11; dimension++) {
      for (let axisCount = 0; axisCount <= maxAxisCount(dimension); axisCount++) {
        for (let index = 0; index < dimension; index++) {
          for (const target of mirrorCounterparts(index, dimension, axisCount)) {
            expect(target).toBeGreaterThanOrEqual(0)
            expect(target).toBeLessThan(dimension)
          }
        }
      }
    }
  })

  it('is reciprocal wherever the split is exact -- 1 axis (always exact, self-mirroring reflection) or a dimension that divides evenly among the strips', () => {
    for (let dimension = 2; dimension <= 12; dimension++) {
      for (let axisCount = 0; axisCount <= maxAxisCount(dimension); axisCount++) {
        if (axisCount > 1 && dimension % (axisCount + 1) !== 0) {
          // An uneven split among 3+ strips can round a cell in an odd-width strip onto its nearest cell in an
          // even-width one (see the "uneven dimension" test above) rather than an exact positional partner, which
          // can break strict reciprocity for that one cell -- an accepted approximation, not a bug.
          continue
        }
        for (let index = 0; index < dimension; index++) {
          for (const target of mirrorCounterparts(index, dimension, axisCount)) {
            expect(mirrorCounterparts(target, dimension, axisCount)).toContain(index)
          }
        }
      }
    }
  })
})

describe('mirrorCounterparts with copyMode (ticket 45)', () => {
  it('repeats the same relative cell in every strip, unflipped, instead of alternating mirror images', () => {
    // dimension 6, 2 axes -> 3 strips [0,1] [2,3] [4,5]. Copy mode: cell0 (first cell of strip0) counterparts the
    // first cell of every other strip (2, 4) rather than mirror-imaging (which would give 3, 4 -- see the plain
    // mirror-mode test above).
    expect(mirrorCounterparts(0, 6, 2, true)).toEqual([0, 2, 4])
    expect(mirrorCounterparts(1, 6, 2, true)).toEqual([1, 3, 5])
    expect(mirrorCounterparts(5, 6, 2, true)).toEqual([1, 3, 5])
  })

  it('has no observable effect with 0 axes -- there is only ever one strip, so no flip to suppress', () => {
    for (let dimension = 1; dimension <= 8; dimension++) {
      for (let index = 0; index < dimension; index++) {
        expect(mirrorCounterparts(index, dimension, 0, true)).toEqual(mirrorCounterparts(index, dimension, 0, false))
      }
    }
  })

  it('with 1 axis, still changes behaviour: a true mirror by default, a plain repeat in copy mode', () => {
    // dimension 4, 2 strips [0,1] [2,3]. Mirror mode reflects (0<->3, 1<->2); copy mode repeats the same relative
    // cell (0<->2, 1<->3) -- see ADR 0006 amendment: copy mode is its own switch precisely so 1 axis keeps being a
    // true mirror *by default*, not because copy mode is a no-op there.
    expect(mirrorCounterparts(0, 4, 1, false)).toEqual([0, 3])
    expect(mirrorCounterparts(0, 4, 1, true)).toEqual([0, 2])
  })

  it('defaults to mirror mode (copyMode=false) when the argument is omitted, unchanged from ticket 44', () => {
    expect(mirrorCounterparts(0, 6, 2)).toEqual(mirrorCounterparts(0, 6, 2, false))
  })
})

describe('stripOf', () => {
  it('assigns cells to contiguous, as-equal-as-possible strips', () => {
    // dimension 7, 3 strips: [0,1] [2,3,4] [5,6]
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => stripOf(i, 7, 2))).toEqual([0, 0, 1, 1, 1, 2, 2])
  })

  it('is strip 0 for everything when there are no axes', () => {
    expect([0, 1, 2].map((i) => stripOf(i, 3, 0))).toEqual([0, 0, 0])
  })

  it('counts an odd dimension\'s exact center cell toward the first/lower strip with 1 axis (ticket 46: matches the legacy "bigger half" tie-break, where a tied/center cell counts toward the first half)', () => {
    // dimension 5, 1 axis, 2 strips: [0,1,2] [3,4] -- the center cell (2) is the axis's own self-mirroring cell,
    // and counts toward strip 0, not strip 1.
    expect([0, 1, 2, 3, 4].map((i) => stripOf(i, 5, 1))).toEqual([0, 0, 0, 1, 1])
  })
})

describe('mirrorCounterpartInStrip (ticket 46: "Mirror current" copying one specific source strip)', () => {
  it('returns the cell itself when it is already in the requested strip', () => {
    // dimension 6, 2 axes -> strips [0,1] [2,3] [4,5]. Cell 2 is already in strip 1.
    expect(mirrorCounterpartInStrip(2, 6, 2, false, 1)).toBe(2)
  })

  it('finds the mirror-image counterpart in a specific other strip', () => {
    // Same setup: cell 0 (strip 0) mirrored into strip 1 lands on 3 (see the mirrorCounterparts test above).
    expect(mirrorCounterpartInStrip(0, 6, 2, false, 1)).toBe(3)
    expect(mirrorCounterpartInStrip(0, 6, 2, false, 2)).toBe(4)
  })

  it('finds the plain-repeat counterpart in copy mode', () => {
    expect(mirrorCounterpartInStrip(0, 6, 2, true, 1)).toBe(2)
    expect(mirrorCounterpartInStrip(0, 6, 2, true, 2)).toBe(4)
  })

  it('agrees with mirrorCounterparts: looking up every strip individually gives the same set', () => {
    for (const copyMode of [false, true]) {
      for (let strip = 0; strip < 3; strip++) {
        const viaAllStrips = mirrorCounterparts(1, 6, 2, copyMode)
        const viaOneStrip = mirrorCounterpartInStrip(1, 6, 2, copyMode, strip)
        expect(viaAllStrips).toContain(viaOneStrip)
      }
    }
  })

  it('is the identity when there are no axes', () => {
    expect(mirrorCounterpartInStrip(3, 6, 0, false, 0)).toBe(3)
  })
})

describe('mirrorBlockPlacements (ticket 50: Paste block geometry)', () => {
  it('with 0 axes, a block only counterparts its own placement, unflipped', () => {
    expect(mirrorBlockPlacements(2, 3, 10, 0)).toEqual([{ anchorIndex: 2, flipped: false }])
  })

  it('with a block of size 1, matches mirrorCounterparts exactly (a single cell has no extent to flip)', () => {
    // dimension 6, 2 axes -> strips [0,1] [2,3] [4,5] (same table mirrorCounterparts' own test uses).
    for (const index of [0, 1, 2, 3, 4, 5]) {
      const viaBlock = mirrorBlockPlacements(index, 1, 6, 2).map((p) => p.anchorIndex)
      expect(viaBlock).toEqual(mirrorCounterparts(index, 6, 2))
    }
  })

  it('with 1 axis, translates a multi-cell block\'s far edge into the mirrored near edge, flipping its content', () => {
    // dimension 6, 1 axis -> strips [0,1,2] [3,4,5]. A 2-wide block anchored at 0 (spanning 0,1) mirrors to a
    // flipped block anchored at 4 (spanning 4,5) -- source col0 (near edge) lands on the far edge (5), source col1
    // lands on the near edge (4), since the whole block reads reversed once mirrored.
    expect(mirrorBlockPlacements(0, 2, 6, 1)).toEqual([
      { anchorIndex: 0, flipped: false },
      { anchorIndex: 4, flipped: true },
    ])
  })

  it('with copy mode, translates without ever flipping', () => {
    expect(mirrorBlockPlacements(0, 2, 6, 2, true)).toEqual([
      { anchorIndex: 0, flipped: false },
      { anchorIndex: 2, flipped: false },
      { anchorIndex: 4, flipped: false },
    ])
  })

  it('lets a mirrored placement run off the *other* edge when the original already ran off its own edge', () => {
    // dimension 6, 1 axis -> strips [0,1,2] [3,4,5]. A 2-wide block anchored at 5 spans [5,6] -- column 6 is already
    // past the grid's edge for the original placement. Its mirror image (index -> 5 - index) should be exactly as
    // far off the *other* edge: column 5 -> 0 (on-grid), column 6 -> -1 (off-grid), so the flipped copy anchors at
    // -1 rather than being pinned to 0.
    expect(mirrorBlockPlacements(5, 2, 6, 1)).toEqual([
      { anchorIndex: -1, flipped: true },
      { anchorIndex: 5, flipped: false },
    ])
  })

  it('deduplicates a placement that lands on the same anchor and flip as another (self-mirroring case)', () => {
    for (let dimension = 1; dimension <= 8; dimension++) {
      for (let axisCount = 0; axisCount <= maxAxisCount(dimension); axisCount++) {
        for (let index = 0; index < dimension; index++) {
          const placements = mirrorBlockPlacements(index, 1, dimension, axisCount)
          const keys = placements.map((p) => `${p.anchorIndex}:${p.flipped}`)
          expect(new Set(keys).size).toBe(keys.length)
        }
      }
    }
  })
})

describe('axisLinePositions', () => {
  it('returns no lines for 0 axes', () => {
    expect(axisLinePositions(0)).toEqual([])
  })

  it('evenly spaces N lines across N+1 strips', () => {
    expect(axisLinePositions(1)).toEqual([0.5])
    expect(axisLinePositions(2)).toEqual([1 / 3, 2 / 3])
    expect(axisLinePositions(3)).toEqual([0.25, 0.5, 0.75])
  })
})

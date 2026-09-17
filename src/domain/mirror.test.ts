import { describe, expect, it } from 'vitest'
import { axisLinePositions, clampAxisCount, maxAxisCount, mirrorCounterparts, stripOf } from './mirror'

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

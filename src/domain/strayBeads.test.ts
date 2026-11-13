import { describe, expect, it } from 'vitest'
import { cleanUpStrayBeads, loneBeadCount, passesOf } from './strayBeads'
import type { Weave } from './weave'

const loom: Weave = { technique: 'loom' }
const peyote: Weave = { technique: 'peyote' }

/** A grid from rows of letters: each letter a color, `.` an empty place. */
function grid(...rows: string[]): (string | undefined)[][] {
  return rows.map((row) => [...row].map((letter) => (letter === '.' ? undefined : letter)))
}
const asText = (raw: readonly (readonly (string | undefined)[])[]) => raw.map((row) => row.map((hex) => hex ?? '.').join(''))
/** Each letter its own color; a color's hex for the tie rule. */
const HEX: Record<string, string> = { a: '#ff0000', b: '#0000ff', c: '#fe0000', d: '#00ff00', x: '#000000' }
const own = (hex: string) => hex
const near = (key: string) => HEX[key]!

describe('Clean up stray beads (ticket 0906, spec 0761)', () => {
  it('gives a lone bead the color most of its neighbours have', () => {
    const result = cleanUpStrayBeads(grid('aaa', 'aba', 'aaa'), own, loom, 1, near)
    expect(asText(result.raw)).toEqual(['aaa', 'aaa', 'aaa'])
    expect(result.cleaned).toBe(1)
    expect([...result.changed]).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0])
  })

  it('keeps a line of two and a one-bead-wide outline', () => {
    const pair = grid('aaaa', 'abba', 'aaaa')
    expect(asText(cleanUpStrayBeads(pair, own, loom, 3, near).raw)).toEqual(['aaaa', 'abba', 'aaaa'])
    const outline = grid('aaaaa', 'axxxa', 'axaxa', 'axxxa', 'aaaaa')
    expect(cleanUpStrayBeads(outline, own, loom, 3, near).cleaned).toBe(1)
    expect(asText(cleanUpStrayBeads(outline, own, loom, 3, near).raw)).toEqual(['aaaaa', 'axxxa', 'axxxa', 'axxxa', 'aaaaa'])
  })

  it('gives a tie to the color nearest the bead’s own', () => {
    // c's neighbours: a above and below (#ff0000), d left and right (#00ff00); c's own #fe0000 is nearest a.
    const result = cleanUpStrayBeads(grid('..a..', '..a..', 'ddcdd', '..a..', '..a..'), own, loom, 1, near)
    expect(asText(result.raw)[2]).toBe('ddadd')
  })

  it('never fills an empty place, and empty places do not vote', () => {
    const result = cleanUpStrayBeads(grid('...', '.b.', '...'), own, loom, 3, near)
    expect(asText(result.raw)).toEqual(['...', '.b.', '...'])
    expect(result.cleaned).toBe(0)
    // Only the one colored neighbour votes: two empties beside b do not outvote it.
    expect(asText(cleanUpStrayBeads(grid('aa.', '.b.', '...'), own, loom, 1, near).raw)).toEqual(['aa.', '.a.', '...'])
  })

  it('leaves a color made empty as it is, and does not count it a neighbour', () => {
    const emptied = (hex: string) => (hex === 'x' ? undefined : hex)
    const result = cleanUpStrayBeads(grid('xxx', 'xbx', 'xxx'), emptied, loom, 3, near)
    expect(asText(result.raw)).toEqual(['xxx', 'xbx', 'xxx'])
  })

  it('compares beads by the color they become, and takes a neighbour’s own picture hex', () => {
    // a1 and a2 both become a: b is lone among them and takes a picture hex of the majority.
    const becomes = (hex: string) => hex[0]!
    const raw = [['a1', 'a2', 'a1'], ['a2', 'b1', 'a1'], ['a1', 'a1', 'a2']]
    const result = cleanUpStrayBeads(raw, becomes, loom, 1, (key) => HEX[key]!)
    expect(result.raw[1]![1]).toMatch(/^a/)
    expect(result.raw[0]).toEqual(['a1', 'a2', 'a1'])
  })

  it('goes through the Technique’s neighbours: a column of two stays on a loom, a bead ringed by one color is alone on peyote', () => {
    // On peyote's staggered columns the bead at row 1, column 1 touches the two beads of each column beside it.
    const raw = grid('aba', 'aba', 'aaa')
    expect(loneBeadCount(raw, own, loom)).toBe(0)
    expect(loneBeadCount(grid('aaa', 'aba', 'aaa'), own, peyote)).toBe(1)
  })

  it('makes one pass for Light, two for Medium and three for Strong', () => {
    // e takes the b of the strays round it in the first pass, which leaves it alone: the second pass reaches it.
    const raw = grid('aaaaa', 'aabaa', 'aceaa', 'aabaa', 'aaaaa')
    const light = cleanUpStrayBeads(raw, own, loom, passesOf('light'), near)
    expect(asText(light.raw)[2]).toBe('aabaa')
    expect(loneBeadCount(light.raw, own, loom)).toBe(1)
    const medium = cleanUpStrayBeads(raw, own, loom, passesOf('medium'), near)
    expect(asText(medium.raw)).toEqual(['aaaaa', 'aaaaa', 'aaaaa', 'aaaaa', 'aaaaa'])
    expect(medium.cleaned).toBe(4)
    expect(cleanUpStrayBeads(raw, own, loom, 0, near).cleaned).toBe(0)
  })

  it('counts the lone beads a grid has', () => {
    expect(loneBeadCount(grid('aab', 'aaa', 'baa'), own, loom)).toBe(2)
    expect(loneBeadCount(grid('ab', 'ba'), own, loom)).toBe(4)
  })
})

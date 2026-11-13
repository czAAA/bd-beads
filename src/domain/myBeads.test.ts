import { describe, expect, it } from 'vitest'
import { myBeadsCodes, ownedTargets, parseMyBeads, withCodeToggled, writeMyBeads } from './myBeads'

describe('My beads (ticket 0902)', () => {
  it('ticks a code into its Color catalog’s list and unticks it, each catalog its own', () => {
    const one = withCodeToggled({}, 'miyuki-delica', 'DB723')
    const two = withCodeToggled(one, 'toho', '49')

    expect(myBeadsCodes(two, 'miyuki-delica')).toEqual(['DB723'])
    expect(myBeadsCodes(two, 'toho')).toEqual(['49'])
    expect(myBeadsCodes(withCodeToggled(two, 'miyuki-delica', 'DB723'), 'miyuki-delica')).toEqual([])
    expect(myBeadsCodes(two, undefined)).toEqual([])
  })

  it('keeps nothing for a catalog whose last code is unticked, and writes nothing for an empty list', () => {
    const emptied = withCodeToggled(withCodeToggled({}, 'toho', '49'), 'toho', '49')

    expect(emptied).toEqual({})
    expect(writeMyBeads(emptied)).toBeNull()
  })

  it('reads back what it wrote, and a saved string that is not a list reads as none', () => {
    const list = { 'miyuki-delica': ['DB723', 'DB1'], toho: ['49'] }

    expect(parseMyBeads(writeMyBeads(list)!)).toEqual(list)
    expect(parseMyBeads('not json')).toBeUndefined()
    expect(parseMyBeads('[1, 2]')).toBeUndefined()
    // A part that does not read is dropped, the rest kept; a code twice is once.
    expect(parseMyBeads('{"toho": ["49", 7, "49"], "miyuki-round": "1F", "miyuki-delica": []}')).toEqual({ toho: ['49'] })
  })

  it('keeps the Bead’s codes to those in the list', () => {
    const targets = [
      { hex: '#d02030', code: 'DB723' },
      { hex: '#ffffff', code: 'DB200' },
      { hex: '#000000', code: 'DB10' },
    ]

    expect(ownedTargets(targets, ['DB10', 'DB723', 'DB999'])).toEqual([targets[0], targets[2]])
  })
})

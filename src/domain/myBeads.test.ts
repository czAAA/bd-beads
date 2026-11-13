import { describe, expect, it } from 'vitest'
import delicaFile from '../data/colorCatalogs/miyuki-delica.json'
import { findBead } from './beads'
import { parseColorCatalog, type ColorCatalog } from './colorCatalog'
import { codeListOf, myBeadsCodes, ownedTargets, parseMyBeads, pastedCodes, withCodeToggled, withCodesAdded, withListCleared, writeMyBeads } from './myBeads'

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

describe('My beads filled by pasting (ticket 0903)', () => {
  const delica11 = findBead('miyuki/delica/11-0')!
  const catalog: ColorCatalog = {
    id: 'miyuki-delica',
    codes: [
      { code: 'DB10', family: ['Black'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
      { code: 'DB200', family: ['White'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
      { code: 'DB721', family: ['Blue'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
      { code: 'DB734', family: ['Green'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
      { code: 'DBS22', family: ['Gold'], finish: 'plated', wording: 'Plated', sizes: ['15/0'] },
    ],
  }

  it('reads codes one a line or between commas, semicolons and spaces, a prefix apart from its number kept to it', () => {
    expect(codeListOf('DB10, 200; 734\nDB9999')).toEqual(['DB10', '200', '734', 'DB9999'])
    expect(codeListOf('  DB 721\t db-0721 ,, ')).toEqual(['DB721', 'db-0721'])
    expect(codeListOf('')).toEqual([])
  })

  it('adds every code the catalog knows, in any of its sizes, and names those it does not know', () => {
    expect(pastedCodes('DB10, 200; 734\nDB9999', catalog, delica11, [])).toEqual({ added: ['DB10', 'DB200', 'DB734'], already: [], unknown: ['DB9999'] })
    expect(pastedCodes('db-0721 DBS22 11-4562', catalog, delica11, [])).toEqual({ added: ['DB721', 'DBS22'], already: [], unknown: ['11-4562'] })
  })

  it('counts a code the list holds already, and a code pasted twice once', () => {
    expect(pastedCodes('DB10 DB721 721 DB-0721', catalog, delica11, ['DB10'])).toEqual({ added: ['DB721'], already: ['DB10'], unknown: [] })
  })

  it('adds codes to a catalog’s list after those it holds, and clears one catalog’s list alone', () => {
    const list = withCodesAdded({ toho: ['49'] }, 'miyuki-delica', ['DB10', 'DB200'])
    expect(withCodesAdded(list, 'miyuki-delica', ['DB721', 'DB10'])).toEqual({ toho: ['49'], 'miyuki-delica': ['DB10', 'DB200', 'DB721'] })
    expect(withListCleared(list, 'miyuki-delica')).toEqual({ toho: ['49'] })
  })

  it('adds forty codes pasted from a note in the shop’s several ways, against the real Delica catalog', () => {
    const note = [
      'DB122, DB123, DB124, DB125, DB126',
      'DB-0127; DB-0128; DB-0129; DB-0131; DB-0132',
      'db133 db134 db135 db141 db144',
      '145\n146\n147\n148\n149',
      'DB 150, DB 151, DB 152, DB 157, DB 158',
      'DB0159 DB0160 DB0161 DB0162 DB0163',
      '#DB164, #DB165, 166, 167, 168',
      'DB169 DB170 DB171 DB172 DB173',
    ].join('\n')

    const pasted = pastedCodes(note, parseColorCatalog(delicaFile, 'miyuki-delica')!, delica11, [])
    expect(pasted.added).toHaveLength(40)
    expect(pasted.unknown).toEqual([])
  })
})

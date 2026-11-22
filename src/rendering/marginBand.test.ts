import { describe, expect, it } from 'vitest'
import { BAND_ORDER, bandRowWidth, bandTools, type BandRow, type BandToolId } from './marginBand'

const ALL: readonly BandToolId[] = BAND_ORDER
const ROWS: readonly BandRow[] = ['full', 'compact', 'folded']
const deps = (room: number, over: Partial<Parameters<typeof bandTools>[0]> = {}) => ({ tools: ALL, rows: ROWS, room, touch: false, expanded: false, ...over })

describe('which Frame tools stand on the band (MarginSheet card, ticket 1195)', () => {
  it('puts every tool on the band in its order, with no menu, where the first row has the room', () => {
    expect(bandTools(deps(1000))).toEqual({ row: 'full', onBand: ALL, overflow: [] })
  })

  it('does the same on a coarse pointer', () => {
    expect(bandTools(deps(1000, { touch: true }))).toEqual({ row: 'full', onBand: ALL, overflow: [] })
  })

  it('steps the row down before it takes a tool off', () => {
    const full = bandRowWidth('full', ALL, false, false, false)
    expect(bandTools(deps(full - 1))?.row).toBe('compact')
    expect(bandTools(deps(full - 1))?.overflow).toEqual([])
  })

  it('takes tools off the last row, the least used first and Edit Frame last, as the room shrinks', () => {
    const left = (room: number, touch = false) => bandTools(deps(room, { rows: ['folded'], touch }))?.overflow
    const whole = bandRowWidth('folded', ALL, false, false, false)
    const seen: (readonly BandToolId[] | undefined)[] = []
    for (let room = whole; room >= 0; room--) if (!seen.length || seen.at(-1)?.join() !== left(room)?.join()) seen.push(left(room))
    expect(seen.slice(0, -1).map((gone) => gone!.length)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(left(whole - 1)).toEqual(['remove'])
    expect(seen[3]).toEqual(['export', 'color', 'remove'])
    expect(seen[5]).toContain('rotate')
    expect(seen[5]).not.toContain('edit')
    expect(seen.at(-1)).toBeUndefined()
  })

  it('leaves out a tool the Frame does not offer, and never lists it in the menu', () => {
    const fit = bandTools(deps(1000, { tools: ['export', 'color', 'remove', 'edit'] }))
    expect(fit?.onBand).toEqual(['edit', 'export', 'color', 'remove'])
    expect(fit?.overflow).toEqual([])
  })

  it('stands the tools further apart on a coarse pointer, so fewer fit', () => {
    const room = bandRowWidth('folded', ALL, false, false, false)
    expect(bandTools(deps(room, { rows: ['folded'] }))?.overflow).toEqual([])
    expect(bandTools(deps(room, { rows: ['folded'], touch: true }))?.overflow.length).toBeGreaterThan(0)
  })

  it('has none where not even the menu button alone fits', () => {
    expect(bandTools(deps(bandRowWidth('folded', [], true, false, false) - 1))).toBeUndefined()
    expect(bandTools(deps(1000, { rows: [] }))).toBeUndefined()
  })

  it('fits the expanded row side by side with no Move bar', () => {
    expect(bandRowWidth('folded', ALL, false, false, true)).toBeLessThan(bandRowWidth('folded', ALL, false, false, false))
  })
})

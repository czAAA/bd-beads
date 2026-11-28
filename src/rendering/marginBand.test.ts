import { describe, expect, it } from 'vitest'
import { MARGIN_PX } from './marginSizes'
import { BAND_ORDER, bandNameRoom, bandRowWidth, bandTools, type BandRow, type BandToolId } from './marginBand'

const ALL: readonly BandToolId[] = BAND_ORDER
const ROWS: readonly BandRow[] = ['full', 'compact', 'folded']
const deps = (room: number, over: Partial<Parameters<typeof bandTools>[0]> = {}) => ({ tools: ALL, rows: ROWS, room, touch: false, ...over })

describe('which Frame tools stand on the band (MarginSheet card, ticket 1195)', () => {
  it('puts every tool on the band in its order, the Frame tools button always beside them (ticket 1220), where the first row has the room', () => {
    expect(bandTools(deps(1000))).toEqual({ row: 'full', onBand: ALL, overflow: [] })
  })

  it('does the same on a coarse pointer', () => {
    expect(bandTools(deps(1000, { touch: true }))).toEqual({ row: 'full', onBand: ALL, overflow: [] })
  })

  it('steps the row down before it takes a tool off', () => {
    const full = bandRowWidth('full', ALL, true, false)
    expect(bandTools(deps(full - 1))?.row).toBe('compact')
    expect(bandTools(deps(full - 1))?.overflow).toEqual([])
  })

  it('takes tools off the last row, the least used first and Edit Frame last, as the room shrinks', () => {
    const left = (room: number, touch = false) => bandTools(deps(room, { rows: ['folded'], touch }))?.overflow
    const whole = bandRowWidth('folded', ALL, true, false)
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
    const room = bandRowWidth('folded', ALL, true, false)
    expect(bandTools(deps(room, { rows: ['folded'] }))?.overflow).toEqual([])
    expect(bandTools(deps(room, { rows: ['folded'], touch: true }))?.overflow.length).toBeGreaterThan(0)
  })

  it('has none where not even the menu button alone fits', () => {
    expect(bandTools(deps(bandRowWidth('folded', [], true, false) - 1))).toBeUndefined()
    expect(bandTools(deps(1000, { rows: [] }))).toBeUndefined()
  })
})

describe('the Frame\'s name after Expand (MarginSheet card, Calmer sheet; ticket 1258)', () => {
  it('counts at its least beside Expand, kept clear on both sides of the centred Move bar', () => {
    expect(bandRowWidth('folded', [], true, false, true) - bandRowWidth('folded', [], true, false)).toBe(2 * (MARGIN_PX.nameGap.mouse + MARGIN_PX.nameLeast))
  })

  it('keeps room for the unfold chevron beside it, so folded details can be brought back', () => {
    expect(bandRowWidth('folded', [], true, false, true, true) - bandRowWidth('folded', [], true, false, true)).toBe(2 * (MARGIN_PX.gap + MARGIN_PX.tab))
    for (let room = 0; room <= 700; room++) {
      const fit = bandTools(deps(room, { name: true, unfold: true }))
      if (fit?.named) expect(bandNameRoom(fit, room, false)).toBeGreaterThanOrEqual(MARGIN_PX.nameLeast + MARGIN_PX.gap + MARGIN_PX.tab)
    }
  })

  it('leaves every tool where the tools\' side is already the wider one', () => {
    const room = bandRowWidth('full', ALL, true, false)
    expect(bandTools(deps(room, { name: true }))).toEqual({ row: 'full', onBand: ALL, overflow: [], named: true })
  })

  it('is left out of a band too narrow for it, which keeps its tools', () => {
    const narrow = bandTools(deps(bandRowWidth('folded', [], true, false), { rows: ['folded'], name: true }))
    expect(narrow).toMatchObject({ row: 'folded', onBand: [] })
    expect(narrow?.named).toBeUndefined()
  })

  it('has at least its least room wherever it is on the band, by either pointer', () => {
    for (const touch of [false, true])
      for (let room = 0; room <= 700; room++) {
        const fit = bandTools(deps(room, { touch, name: true }))
        if (fit?.named) expect(bandNameRoom(fit, room, touch)).toBeGreaterThanOrEqual(MARGIN_PX.nameLeast)
      }
  })
})

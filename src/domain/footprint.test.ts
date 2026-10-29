// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { frameFootprint } from './footprint'

const frame = { row: 2, column: 3, rows: 48, columns: 11 }

describe('frameFootprint (ADR 0066)', () => {
  it('is the Frame\'s own rectangle where Canvas and Frame are woven alike', () => {
    expect(frameFootprint({ technique: 'peyote' }, { ...frame, technique: 'peyote' })).toEqual(frame)
    expect(frameFootprint({ technique: 'loom' }, { ...frame, technique: 'loom' })).toEqual(frame)
  })

  it('stops where a peyote Frame stops drawing on a loom Canvas: its rows nest closer than the Canvas\'s are tall', () => {
    // 48 peyote rows are 1 + 47 × 0.75 = 36.25 beads tall; the loom rows whose middle lies inside it are 36.
    expect(frameFootprint({ technique: 'loom' }, { ...frame, technique: 'peyote' })).toEqual({ ...frame, rows: 36 })
  })

  it('reaches further down a peyote Canvas for a loom Frame, which draws taller than it has rows', () => {
    expect(frameFootprint({ technique: 'peyote' }, { ...frame, technique: 'loom' }).rows).toBe(64)
  })

  it('keeps the Frame\'s columns and corner', () => {
    expect(frameFootprint({ technique: 'loom' }, { ...frame, technique: 'brick' })).toEqual(frame)
  })
  it("covers the Canvas positions whose middle lies inside a Frame drawn in a smaller Bead (ticket 0665)", () => {
    // 48 rows by 11 beads at three quarters of the Canvas's width draw 36 by 8.25 Canvas beads.
    expect(frameFootprint({ technique: 'loom' }, { ...frame, technique: 'loom', scale: 0.75 })).toEqual({ ...frame, rows: 36, columns: 8 })
  })

  it('covers more Canvas positions under a Frame drawn in a larger Bead', () => {
    expect(frameFootprint({ technique: 'loom' }, { ...frame, technique: 'loom', scale: 1.5 })).toEqual({ ...frame, rows: 72, columns: 16 })
  })
})

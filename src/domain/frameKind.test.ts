// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { frameKindOf, rowOrderOf } from './frameKind'
import type { Weave } from './weave'

/** A bare Frame of `rows` by `columns` positions in a Weave, with no kind stored. */
const sheet = (rows: number, columns: number, weave: Weave = { technique: 'loom' }) => ({ rows, columns, ...weave })

describe('the Frame kind (spec 0590, ticket 0591)', () => {
  it('reads a Frame with no kind as Rectangular, which drops its beads onto the Canvas on Remove Frame', () => {
    expect(frameKindOf({})).toMatchObject({ id: 'rectangular', removedBeads: 'dropped' })
    expect(frameKindOf({ kind: 'rectangular' }).id).toBe('rectangular')
  })
})

describe('the Row order of a Rectangular Frame', () => {
  it('weaves peyote one pass for the first row and two for each later one, even positions first', () => {
    const order = rowOrderOf(sheet(3, 4, { technique: 'peyote' }), { direction: 'rows' })
    expect(order.count).toBe(5)
    expect(order.positionsOf(0)).toEqual([0, 1, 2, 3].map((column) => ({ row: 0, column })))
    expect(order.positionsOf(1)).toEqual([{ row: 1, column: 0 }, { row: 1, column: 2 }])
    expect(order.positionsOf(2)).toEqual([{ row: 1, column: 1 }, { row: 1, column: 3 }])
    expect(order.passAt({ row: 2, column: 3 })).toBe(4)
    expect([0, 1, 2, 3, 4].map((pass) => order.lineOf(pass))).toEqual([0, 1, 1, 2, 2])
  })

  it('counts its rows from the far end when reversed (ticket 0589)', () => {
    const order = rowOrderOf(sheet(3, 2), { direction: 'rows', reversed: true })
    expect(order.positionsOf(0)).toEqual([{ row: 2, column: 0 }, { row: 2, column: 1 }])
    expect(order.passAt({ row: 0, column: 1 })).toBe(2)
    expect(order.lineOf(0)).toBe(2)
  })

  it('runs down the columns when the rows run that way', () => {
    const order = rowOrderOf(sheet(2, 3), { direction: 'columns' })
    expect(order.count).toBe(3)
    expect(order.positionsOf(1)).toEqual([{ row: 0, column: 1 }, { row: 1, column: 1 }])
    expect(order.passAt({ row: 1, column: 2 })).toBe(2)
  })

  it('has no pass past the last or before the first', () => {
    const order = rowOrderOf(sheet(3, 2), { direction: 'rows' })
    expect(order.positionsOf(3)).toEqual([])
    expect(order.positionsOf(-1)).toEqual([])
  })

  it('weaves Right-angle weave a line of Units a pass, the first one with its top', () => {
    const order = rowOrderOf(sheet(5, 3, { technique: 'rightAngle' }), { direction: 'rows' })
    expect(order.count).toBe(2)
    expect(order.passAt({ row: 2, column: 0 })).toBe(0)
    expect(order.passAt({ row: 3, column: 0 })).toBe(1)
  })

  it('weaves Netting a row of diamonds a pass, each later one the rows below the last', () => {
    const order = rowOrderOf(sheet(9, 5, { technique: 'netting', netSize: 3 }), { direction: 'rows' })
    expect(order.count).toBe(3)
    expect([...new Set(order.positionsOf(0).map(({ row }) => row))]).toEqual([0, 1, 2, 3, 4])
    expect([...new Set(order.positionsOf(1).map(({ row }) => row))]).toEqual([5, 6])
    expect(order.lineOf(1)).toBe(2)
  })

  it('lets the weaver turn the way rows run, except on Netting, woven in rows only', () => {
    expect(rowOrderOf(sheet(3, 3), { direction: 'rows' }).turns).toBe(true)
    expect(rowOrderOf(sheet(9, 9, { technique: 'netting', netSize: 3 }), { direction: 'rows' }).turns).toBe(false)
  })
})

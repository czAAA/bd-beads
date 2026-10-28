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

/** A Custom frame of a kind and size as Row progress reads it: its rectangle does not matter to its Row order. */
const custom = (kind: 'triangle' | 'kite' | 'star' | 'kaleidocycle', size: number) => {
  const name = kind === 'kite' ? 'rows' : kind === 'triangle' ? 'rounds' : 'partSize'
  return { kind, settings: { [name]: size }, rows: 1, columns: 1, technique: 'peyote' as const }
}

describe('the Row order of a Custom frame (ticket 0594)', () => {
  it('steps a Triangle round by round from the centre, each round round the shape, and never turns', () => {
    const order = rowOrderOf(custom('triangle', 4), { direction: 'rows' })
    expect(order.count).toBe(4)
    expect(order.turns).toBe(false)
    expect(order.positionsOf(1)).toEqual(Array.from({ length: 6 }, (_unused, column) => ({ row: 1, column })))
    expect(order.passAt({ row: 2, column: 5 })).toBe(2)
    expect(order.lineOf(0)).toBeUndefined()
    expect(order.stepOf?.(3)).toEqual({ kind: 'round', number: 4 })
  })

  it('steps a Kite row by row from its point, each row read left to right across its wings', () => {
    const order = rowOrderOf(custom('kite', 21), { direction: 'rows' })
    expect(order.count).toBe(21)
    const row = order.positionsOf(4)
    // The left wing's places are even and run in to the spine, the right wing's odd and run out.
    expect(row.map(({ column }) => column)).toEqual([6, 4, 2, 0, 1, 3, 5, 7])
    expect(order.stepOf?.(4)).toEqual({ kind: 'row', number: 5 })
  })

  it('steps a Star part by part in making order, round by round, and then through its joins', () => {
    const order = rowOrderOf(custom('star', 3), { direction: 'rows' })
    expect(order.count).toBe(5 * 3 + 5)
    // Part 2's second round: its four sides' two beads each, named on after parts 0 and 1.
    expect(order.stepOf?.(7)).toEqual({ kind: 'round', number: 2, part: 3 })
    expect(order.positionsOf(7)).toEqual(Array.from({ length: 8 }, (_unused, place) => ({ row: 1, column: 16 + place })))
    expect(order.passAt({ row: 1, column: 16 })).toBe(7)
    expect(order.stepOf?.(15)).toEqual({ kind: 'join', step: 'zip', parts: [1, 2] })
    expect(order.stepOf?.(19)).toEqual({ kind: 'join', step: 'close', parts: [5, 1] })
    // A zip rings the edges it puts together: beads of both parts' last rounds, none of their first.
    const zipped = order.positionsOf(15)
    expect(zipped.length).toBeGreaterThan(0)
    expect(zipped.every(({ row }) => row === 2)).toBe(true)
    expect(new Set(zipped.map(({ column }) => Math.floor(column / 12)))).toEqual(new Set([0, 1]))
  })

  it('goes through a Kaleidocycle\'s zips, hinges and closing joins after its six triangles', () => {
    const order = rowOrderOf(custom('kaleidocycle', 3), { direction: 'rows' })
    expect(order.count).toBe(6 * 3 + 6 + 3 + 3)
    expect(order.stepOf?.(18)).toEqual({ kind: 'join', step: 'zip', parts: [1] })
    // A triangle zipped into its own strip shows no edge on the face.
    expect(order.positionsOf(18)).toEqual([])
    expect(order.stepOf?.(24)).toEqual({ kind: 'join', step: 'hinge', parts: [1, 2] })
    expect(order.positionsOf(24).length).toBeGreaterThan(0)
  })

  it('steps a Fringe earring through its top from the base row up, then strand by strand from the first (ticket 0597)', () => {
    const earring = { kind: 'fringeEarring' as const, settings: { topWidth: 4, topRows: 3, fringeStyle: 'straight' as const, fringeLength: 5 }, rows: 1, columns: 1, technique: 'brick' as const }
    const order = rowOrderOf(earring, { direction: 'rows' })
    expect(order.count).toBe(3 + 4)
    expect(order.turns).toBe(false)
    expect(order.stepOf?.(0)).toEqual({ kind: 'row', number: 1 })
    expect(order.positionsOf(0)).toEqual([0, 1, 2, 3].map((column) => ({ row: 0, column })))
    expect(order.positionsOf(2)).toEqual([0, 1].map((column) => ({ row: 2, column })))
    expect(order.stepOf?.(3)).toEqual({ kind: 'strand', number: 1 })
    // A strand is strung from the top down.
    expect(order.positionsOf(4)).toEqual([0, 1, 2, 3, 4].map((bead) => ({ row: 1000 + bead, column: 1 })))
    expect(order.passAt({ row: 1003, column: 3 })).toBe(6)
    // Turned upside down by Rotate Frame, a strand is still strung from the top.
    expect(rowOrderOf({ ...earring, quarterTurns: 2 }, { direction: 'rows' }).positionsOf(4)).toEqual([0, 1, 2, 3, 4].map((bead) => ({ row: 1000 + bead, column: 1 })))
  })

  it('finishes no position it does not have', () => {
    expect(rowOrderOf(custom('triangle', 2), { direction: 'rows' }).passAt({ row: 5, column: 0 })).toBe(Number.POSITIVE_INFINITY)
  })
})

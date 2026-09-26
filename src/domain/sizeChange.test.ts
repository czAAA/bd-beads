// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, findBead } from './beads'
import { planSizeChange } from './sizeChange'

const current = { columns: 160, rows: 30 }
const cube = findBead('toho-cube-1.5mm')!
const round = findBead('toho-round-11-0')!
const delica = findBead('miyuki-delica-11-0')!

describe('planSizeChange', () => {
  it('reads beads as the grid itself', () => {
    const plan = planSizeChange(current, { widthText: '100', heightText: '30', unit: 'beads' }, cube)
    expect(plan).toMatchObject({ ok: true, target: { columns: 100, rows: 30 }, shrinks: true })
  })

  it.each([
    [cube, { columns: 107, rows: 20 }],
    // 160mm / (1.5 + 0.15 correction) and 30mm / 2.2mm
    [round, { columns: 97, rows: 14 }],
    [delica, { columns: 100, rows: 23 }],
  ])('converts 160 x 30 mm through %o, the same as the New Pattern form', (bead, expected) => {
    const plan = planSizeChange(current, { widthText: '160', heightText: '30', unit: 'mm' }, bead)
    expect(plan).toMatchObject({ ok: true, target: expected })
  })

  it('converts cm as ten times mm', () => {
    const plan = planSizeChange(current, { widthText: '16', heightText: '3', unit: 'cm' }, round)
    expect(plan).toMatchObject({ ok: true, target: { columns: 97, rows: 14 } })
  })

  it('covers every catalog Bead', () => {
    for (const bead of BEAD_CATALOG) {
      expect(planSizeChange(current, { widthText: '10', heightText: '10', unit: 'mm' }, bead).ok).toBe(true)
    }
  })

  it('says whether the new grid is smaller in either direction', () => {
    const shrinks = (columns: string, rows: string) =>
      (planSizeChange(current, { widthText: columns, heightText: rows, unit: 'beads' }, cube) as { shrinks: boolean }).shrinks
    expect(shrinks('160', '30')).toBe(false)
    expect(shrinks('200', '60')).toBe(false)
    expect(shrinks('159', '60')).toBe(true)
    expect(shrinks('200', '29')).toBe(true)
  })

  it.each([
    ['', '30', 'beads', 'empty'],
    ['10', '  ', 'beads', 'empty'],
    ['abc', '30', 'beads', 'not-a-number'],
    ['0', '30', 'mm', 'not-positive'],
    ['10', '-3', 'cm', 'not-positive'],
    ['10.5', '30', 'beads', 'not-whole'],
  ] as const)('refuses %j x %j %s as %s', (widthText, heightText, unit, problem) => {
    expect(planSizeChange(current, { widthText, heightText, unit }, cube)).toEqual({ ok: false, problem })
  })

  it('accepts fractions in mm and has no upper limit', () => {
    expect(planSizeChange(current, { widthText: '10.5', heightText: '3.2', unit: 'mm' }, cube).ok).toBe(true)
    expect(planSizeChange(current, { widthText: '100000', heightText: '100000', unit: 'beads' }, cube).ok).toBe(true)
  })

  it('cannot convert mm/cm without a Bead, but beads still work', () => {
    expect(planSizeChange(current, { widthText: '10', heightText: '10', unit: 'mm' }, undefined)).toEqual({
      ok: false,
      problem: 'no-bead',
    })
    expect(planSizeChange(current, { widthText: '10', heightText: '10', unit: 'beads' }, undefined).ok).toBe(true)
  })
})

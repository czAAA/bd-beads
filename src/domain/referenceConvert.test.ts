// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsReplaced, convertSampled, sampledColors, withConvertedBeads } from './referenceConvert'
import { NO_COLOR, type PixelData } from './imageConversion'
import { beadsOfLayer } from './layerRecord'
import { bareProject } from '../testUtils/layerFields'

const RED = 0xff0000
const DARK_RED = 0xee0000
const BLUE = 0x0000ff

/** A picture of `colors` in one row of pixels, each fully opaque but NO_COLOR, which is see-through. */
function strip(colors: number[]): PixelData {
  const data = colors.flatMap((color) => (color === NO_COLOR ? [0, 0, 0, 0] : [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 255]))
  return { width: colors.length, height: 1, data }
}

const row = (columns: number[]) => columns.map((column, at) => ({ row: 0, column, u: (at + 0.5) / columns.length, v: 0.5 }))

describe('the beads Convert to beads makes (ReferenceImage card)', () => {
  it('reads each position the colour of the picture under its centre, and none where the picture lets the Canvas through', () => {
    const sampled = sampledColors(strip([RED, NO_COLOR, BLUE]), row([4, 5, 6]))
    expect(sampled).toEqual([
      { row: 0, column: 4, color: RED },
      { row: 0, column: 5, color: NO_COLOR },
      { row: 0, column: 6, color: BLUE },
    ])
  })

  it('keeps every colour of the picture under Exact at the most colours', () => {
    const sampled = sampledColors(strip([RED, DARK_RED, BLUE, NO_COLOR]), row([0, 1, 2, 3]))
    const conversion = convertSampled(sampled, 3, undefined)
    expect(conversion.changes).toEqual([
      { row: 0, column: 0, color: '#ff0000' },
      { row: 0, column: 1, color: '#ee0000' },
      { row: 0, column: 2, color: '#0000ff' },
    ])
    expect(conversion.colorsFound).toBe(3)
    expect([...conversion.colors].sort()).toEqual(['#0000ff', '#ee0000', '#ff0000'])
  })

  it('reduces to the Colors count, near colours joined', () => {
    const sampled = sampledColors(strip([RED, DARK_RED, BLUE]), row([0, 1, 2]))
    const conversion = convertSampled(sampled, 2, undefined)
    expect(conversion.colors).toHaveLength(2)
    expect(conversion.changes[0]!.color).toBe(conversion.changes[1]!.color)
    expect(conversion.changes[2]!.color).toBe('#0000ff')
  })

  it('matches each colour to the nearest of a palette', () => {
    const sampled = sampledColors(strip([DARK_RED, BLUE]), row([0, 1]))
    const conversion = convertSampled(sampled, 2, [{ hex: '#ff0000', colorId: 'red' }, { hex: '#000080', colorId: 'navy' }])
    expect(conversion.changes.map((change) => change.color)).toEqual(['#ff0000', '#000080'])
  })
})

describe('laying the beads on the Canvas', () => {
  const changes = [
    { row: 0, column: 0, color: '#ff0000' },
    { row: 0, column: 1, color: '#0000ff' },
  ]

  it('puts them on the Canvas, replacing what was there, and counts the beads replaced', () => {
    const project = bareProject({ technique: 'loom', beads: { 0: { 1: '#00ff00', 5: '#00ff00' } } })
    expect(beadsReplaced(project, changes)).toBe(1)
    expect(beadsOfLayer(withConvertedBeads(project, changes), 'canvas')).toEqual({ 0: { 0: '#ff0000', 1: '#0000ff', 5: '#00ff00' } })
  })

  it('puts none under a Frame woven unlike the Canvas, which hides it there', () => {
    const project = bareProject({ technique: 'loom', frame: { row: 0, column: 1, rows: 2, columns: 2, technique: 'peyote', beads: {} } })
    const converted = withConvertedBeads(project, changes)
    expect(beadsOfLayer(converted, 'canvas')).toEqual({ 0: { 0: '#ff0000' } })
    expect(beadsOfLayer(converted, 'frame')).toEqual({})
  })

  it('puts those under a Frame woven like the Canvas on the Frame, in its own positions', () => {
    const project = bareProject({ technique: 'loom', frame: { row: 0, column: 1, rows: 2, columns: 2, technique: 'loom', beads: { 0: { 0: '#00ff00' } } } })
    expect(beadsReplaced(project, changes)).toBe(1)
    const converted = withConvertedBeads(project, changes)
    expect(beadsOfLayer(converted, 'canvas')).toEqual({ 0: { 0: '#ff0000' } })
    expect(beadsOfLayer(converted, 'frame')).toEqual({ 0: { 0: '#0000ff' } })
  })
})

import { describe, expect, it } from 'vitest'
import { findBead } from './beads'
import { beadCount } from './canvas'
import { changeFrame, type FrameChangeResult } from './changeFrame'
import { frameLayoutOf, settingsOf, type FrameSettings } from './frameKind'
import { createProject } from './createProject'
import {
  designDifferences,
  designFits,
  designPicks,
  designSizes,
  euRingSize,
  placedStarter,
  STARTER_CATEGORIES,
  starterBeadCount,
  starterById,
  starterDesign,
  starterFrameSize,
  starterMeasure,
  starterProject,
  starterSizeRanges,
  usRingSize,
} from './starters'

const beadId = 'miyuki/delica/11-0'
const delica = findBead(beadId)!
const allStarters = STARTER_CATEGORIES.flatMap((category) => category.starters)
const asDesigned = (id: Parameters<typeof starterById>[0]) => ({ sizes: designSizes(starterById(id)), useDesign: true })

describe('the Starter registry', () => {
  it('has the Shapes, Earrings, Rings and Bands, each with its best design', () => {
    expect(STARTER_CATEGORIES.map((category) => [category.id, category.best.id])).toEqual([
      ['shapes', 'star'],
      ['earrings', 'vFringe'],
      ['rings', 'ringChevrons'],
      ['bands', 'bandDiamonds'],
    ])
    expect(STARTER_CATEGORIES[0]!.starters.map((starter) => starter.id)).toEqual(['triangle', 'warpedSquare', 'kite', 'star', 'kaleidocycle'])
    expect(STARTER_CATEGORIES[1]!.starters.map((starter) => starter.id)).toEqual(['straightFringe', 'vFringe'])
    expect(STARTER_CATEGORIES[2]!.starters.map((starter) => starter.id)).toEqual(['ringStripes', 'ringChevrons', 'ringDiamonds', 'ringPlaid'])
    expect(STARTER_CATEGORIES[3]!.starters.map((starter) => starter.id)).toEqual(['bandStripes', 'bandChevrons', 'bandDiamonds', 'bandPlaid'])
  })

  it('makes each design for its own size: a Triangle of 10 rounds holds 165 beads, a Warped Square of 8 holds 144', () => {
    expect(designSizes(starterById('triangle'))).toEqual({ rounds: 10 })
    expect(starterBeadCount(starterById('triangle'), asDesigned('triangle'), delica)).toBe(165)
    expect(starterBeadCount(starterById('warpedSquare'), asDesigned('warpedSquare'), delica)).toBe(144)
  })

  for (const starter of allStarters) {
    it(`fills every position of the ${starter.id} design's Frame, and nothing beyond it`, () => {
      const beads = starterDesign(starter)
      const layout = frameLayoutOf({ kind: starter.kind, settings: { ...designSizes(starter), ...designPicks(starter) } as FrameSettings })
      const { rows, columns } = starterFrameSize(starter, { sizes: designSizes(starter), useDesign: true }, delica)
      const positions = layout ? layout.positions : Array.from({ length: rows * columns }, (_unused, index) => ({ row: Math.floor(index / columns), column: index % columns }))
      expect(beadCount(beads)).toBe(positions.length)
      for (const { row, column } of positions) expect(beads[row]?.[column]).toMatch(/^#[0-9a-f]{6}$/)
    })

    it(`offers the ${starter.id} design's sizes among its chips, every chip within its range`, () => {
      for (const { size, presets, min, max } of starter.sizes) {
        expect(presets).toContain(size)
        for (const preset of presets) expect(preset >= min && preset <= max).toBe(true)
      }
    })
  }
})

describe('a new Project from a Starter', () => {
  it('puts the design in place in the Frame, named as asked, on the chosen Bead', () => {
    const project = starterProject(starterById('triangle'), { name: 'Sun', beadId, ...asDesigned('triangle') })
    expect(project).toMatchObject({ name: 'Sun', beadId, frame: { kind: 'triangle', settings: { rounds: 10 } } })
    expect(project.frame!.beads).toEqual(starterDesign(starterById('triangle')))
    expect(project.beads).toEqual({})
  })

  it('puts the same Frame in place empty when it starts empty, or at another size', () => {
    expect(starterProject(starterById('star'), { name: 'Star', beadId, sizes: { partSize: 5 }, useDesign: false }).frame).toMatchObject({ kind: 'star', settings: { partSize: 5 }, beads: {} })
    expect(starterProject(starterById('star'), { name: 'Star', beadId, sizes: { partSize: 7 }, useDesign: true }).frame).toMatchObject({ settings: { partSize: 7 }, beads: {} })
  })

  it('records nothing of the Starter', () => {
    for (const id of ['kite', 'vFringe', 'bandPlaid'] as const) {
      expect(JSON.stringify(starterProject(starterById(id), { name: 'Piece', beadId, ...asDesigned(id) }))).not.toMatch(/starter/i)
    }
  })
})

describe('an Earring Starter (ticket 0597)', () => {
  it('is a brick-stitch Fringe earring of its top and fringe, its Fringe style the design\'s: the V fringe 87 beads', () => {
    const project = starterProject(starterById('vFringe'), { name: 'Drop', beadId, ...asDesigned('vFringe') })
    expect(project).toMatchObject({ technique: 'brick', frame: { kind: 'fringeEarring', technique: 'brick', settings: { topWidth: 7, topRows: 6, fringeStyle: 'v', fringeLength: 12 } } })
    expect(project.frame!.beads).toEqual(starterDesign(starterById('vFringe')))
    expect(starterBeadCount(starterById('vFringe'), asDesigned('vFringe'), delica)).toBe(87)
    expect(starterBeadCount(starterById('straightFringe'), asDesigned('straightFringe'), delica)).toBe(97)
  })

  it('puts the same earring in place empty at another length, or with the other Fringe style', () => {
    const straight = starterById('straightFringe')
    expect(starterProject(straight, { name: 'Drop', beadId, sizes: { fringeLength: 12 }, useDesign: true }).frame).toMatchObject({ settings: { fringeStyle: 'straight', fringeLength: 12 }, beads: {} })
    expect(starterProject(straight, { name: 'Drop', beadId, sizes: {}, picks: { fringeStyle: 'v' }, useDesign: true }).frame).toMatchObject({ settings: { fringeStyle: 'v' }, beads: {} })
    expect(designDifferences(straight, { sizes: { fringeLength: 12 }, picks: { fringeStyle: 'v' } })).toEqual([{ size: straight.sizes[2] }, { pick: straight.picks[0] }])
  })

  it('offers fewer Top rows than its Top width has beads, so the top ends on a pair', () => {
    expect(starterSizeRanges(starterById('straightFringe'), { topWidth: 6 }).topRows).toEqual({ min: 1, max: 5 })
    expect(starterSizeRanges(starterById('straightFringe'), {}).topWidth).toEqual({ min: 2, max: 30 })
  })
})

describe('a Ring or Band Starter (ticket 0597)', () => {
  const toho = findBead('toho-cube-1.5mm')!
  const ringAt = (ringSize: number) => ({ sizes: { width: 7, ringSize }, useDesign: false })

  it('lies across in peyote, its Width in rows and its length in columns of the Bead: a Ring 4 mm longer than the finger', () => {
    // EU 54 is 54 mm round; 58 mm of Delica 11/0, 1.6 mm a column, is 36 columns, 72 rows round.
    expect(starterFrameSize(starterById('ringStripes'), ringAt(54), delica)).toEqual({ rows: 7, columns: 36 })
    expect(starterMeasure(starterById('ringStripes'), ringAt(54), delica)).toEqual({ shape: 'ring', insideMm: 54 / Math.PI, widthMm: 7 * 1.3, rows: 72 })
    expect(starterBeadCount(starterById('ringStripes'), ringAt(54), delica)).toBe(252)
    expect(starterProject(starterById('ringStripes'), { name: 'Ring', beadId, ...asDesigned('ringStripes') })).toMatchObject({ technique: 'peyote', frame: { rows: 7, columns: 36, technique: 'peyote' } })
  })

  it('makes a Band of the wrist and its Fit\'s ease, less 1.5 cm for the clasp', () => {
    // A 16 cm wrist, Comfortable (1.5 cm) less the clasp: 160 mm, 100 columns, 200 rows.
    const comfortable = { sizes: { width: 11, wrist: 16 }, useDesign: false }
    expect(starterFrameSize(starterById('bandStripes'), comfortable, delica)).toEqual({ rows: 11, columns: 100 })
    expect(starterMeasure(starterById('bandStripes'), comfortable, delica)).toMatchObject({ shape: 'band', lengthMm: 160, rows: 200 })
    expect(starterFrameSize(starterById('bandStripes'), { ...comfortable, picks: { fit: 'snug' } }, delica).columns).toBe(Math.round(155 / 1.6))
    expect(starterFrameSize(starterById('bandStripes'), { ...comfortable, picks: { fit: 'loose' } }, delica).columns).toBe(Math.round(165 / 1.6))
    expect(starterFrameSize(starterById('bandStripes'), comfortable, toho).columns).toBe(Math.round(160 / 1.5))
    expect(designFits(starterById('bandStripes'), { sizes: { width: 11, wrist: 16 }, picks: { fit: 'loose' } })).toBe(false)
  })

  it('gives a Ring size in US sizes and back: US 7 is EU 54, US 9 is EU 59', () => {
    expect(usRingSize(54)).toBe(7)
    expect(usRingSize(59)).toBe(9)
    expect(Math.round(euRingSize(7))).toBe(54)
    expect(designFits(starterById('ringChevrons'), { sizes: { width: 7, ringSize: euRingSize(7) } })).toBe(true)
    expect(designFits(starterById('ringChevrons'), { sizes: { width: 7, ringSize: euRingSize(7.5) } })).toBe(false)
  })

  it('keeps the design\'s own rectangle when put in place on another Bead, never cropping it', () => {
    const project = starterProject(starterById('bandDiamonds'), { name: 'Band', beadId: 'toho-cube-1.5mm', ...asDesigned('bandDiamonds') })
    expect(project.frame).toMatchObject({ rows: 11, columns: 100, technique: 'peyote' })
    expect(project.frame!.beads).toEqual(starterDesign(starterById('bandDiamonds')))
  })
})

describe('a Starter put on an open Project', () => {
  const open = createProject({ technique: 'loom', beadId, name: 'Open' })

  it('puts the design in place round the centre, over the Canvas, Row progress at the first pass', () => {
    const painted = { ...open, beads: { 3: { 3: '#00ff00' } } }
    const result = placedStarter(painted, starterById('warpedSquare'), asDesigned('warpedSquare'), { row: 20, column: 30 })
    if (result.kind !== 'changed') throw new Error(result.kind)
    expect(result.project.frame).toMatchObject({ kind: 'warpedSquare', settings: { rounds: 8 } })
    expect(result.project.frame!.beads).toEqual(starterDesign(starterById('warpedSquare')))
    expect(result.project.beads).toBe(painted.beads)
    expect(result.project.technique).toBe('loom')
  })

  it('is the same Frame as an empty Custom frame of that kind and size', () => {
    const frameOf = (result: FrameChangeResult) => (result.kind === 'changed' ? result.project.frame : undefined)
    const empty = frameOf(placedStarter(open, starterById('kaleidocycle'), { sizes: { partSize: 9 }, useDesign: false }, { row: 0, column: 0 }))
    expect(empty).toMatchObject({ kind: 'kaleidocycle', beads: {} })
    expect(empty).toEqual(frameOf(changeFrame(open, { custom: { kind: 'kaleidocycle', size: 9, centre: { row: 0, column: 0 } } })))
  })

  it('puts a Ring in its own Technique round the centre, its length from the Project\'s Bead', () => {
    const result = placedStarter(open, starterById('ringDiamonds'), asDesigned('ringDiamonds'), { row: 50, column: 50 })
    if (result.kind !== 'changed') throw new Error(result.kind)
    expect(result.project.frame).toMatchObject({ rows: 7, columns: 36, technique: 'peyote' })
    expect(settingsOf(result.project.frame!)).toBeUndefined()
    expect(result.project.frame!.beads).toEqual(starterDesign(starterById('ringDiamonds')))
    expect(result.project.technique).toBe('loom')
  })
})

import { describe, expect, it } from 'vitest'
import { findBead } from './beads'
import { beadCount } from './canvas'
import { changeFrame, turnedCustomFrame, type FrameChangeResult } from './changeFrame'
import { FRAME_SHAPE_IDS, frameShapeOf, frameLayoutOf, settingsOf, techniquesOf, type FrameSettings } from './frameShape'
import { createProject } from './createProject'
import { weaveOf } from './layerWeave'
import { TECHNIQUES } from './weave'
import {
  BAND_EASE_MM,
  designDifferences,
  designFits,
  designPicks,
  designSizes,
  euRingSize,
  placedStarter,
  STARTER_BEAD_ID,
  STARTER_CATEGORIES,
  starterBeadCount,
  starterById,
  starterDesign,
  starterFrameSize,
  starterMeasure,
  starterProject,
  starterSizeRanges,
  sizesWith,
  usRingSize,
  type StarterManifest,
} from './starters'
import { beadsOfLayer, canvasOf, frameOf, withBackground } from './layerRecord'
import { frameGeometryOf } from './layers'
import { laidFrame } from './frameOrientation'
import { rotateCanvas } from './rotate'
import { frameSheetOf, layersView, withLayers } from '../testUtils/layerFields'

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

  it('measures a Star of Part size 10 in Delica 11/0 about 5 cm across, as a MiniStar is (ticket 0875)', () => {
    const { widthMm } = starterMeasure(starterById('star'), { sizes: { partSize: 10 }, useDesign: false }, delica) as { widthMm: number }
    // The bead centres span 36.8 bead widths; the box adds half a bead's diagonal each side.
    expect(widthMm).toBeGreaterThan(48)
    expect(widthMm).toBeLessThan(51)
  })

  for (const starter of allStarters) {
    it(`fills every position of the ${starter.id} design's Frame, and nothing beyond it`, () => {
      const beads = starterDesign(starter)
      const layout = frameLayoutOf({ shape: starter.shape, settings: { ...designSizes(starter), ...designPicks(starter) } as FrameSettings })
      const { rows, columns } = starterFrameSize(starter, { sizes: designSizes(starter), useDesign: true }, delica)
      const positions = layout ? layout.positions : Array.from({ length: rows * columns }, (_unused, index) => ({ row: Math.floor(index / columns), column: index % columns }))
      expect(beadCount(beads)).toBe(positions.length)
      for (const { row, column } of positions) expect(beads[row]?.[column]).toMatch(/^#[0-9a-f]{6}$/)
    })

    it(`offers the ${starter.id} design's sizes among its chips, every chip within its range`, () => {
      for (const { default: size, presets, min, max } of starter.sizes) {
        expect(presets).toContain(size)
        for (const preset of presets) expect(preset >= min && preset <= max).toBe(true)
      }
    })
  }
})

describe('the Starter manifests (ticket 0633)', () => {
  const files = import.meta.glob<StarterManifest>('../data/starters/*.starter.json', { eager: true, import: 'default' })
  const manifests = Object.entries(files).map(([path, manifest]) => ({ file: path.split('/').pop()!, manifest }))

  it('lists every manifest in one category, once, each under its own file name and with a design beside it', () => {
    for (const { file, manifest } of manifests) expect(file, 'its file name').toBe(`${manifest.id}.starter.json`)
    expect(allStarters.map((starter) => starter.id).sort(), 'listed once each').toEqual(manifests.map(({ manifest }) => manifest.id).sort())
    for (const starter of allStarters) expect(starterDesign(starter), `${starter.id}'s design`).not.toEqual({})
    for (const category of STARTER_CATEGORIES) expect(category.starters, `${category.id}'s best`).toContain(category.best)
  })

  it('keeps each design as its Frame\'s size and beads alone, no Project around them (ticket 0636)', () => {
    for (const starter of allStarters) expect(Object.keys(starter.file).sort(), starter.id).toEqual(['columns', 'encodedBeads', 'rows'])
  })

  for (const starter of allStarters) {
    it(`gives the ${starter.id} Starter a known Frame shape or none, one Weave its shape supports, and the sizes and choices its measuring rule reads`, () => {
      const custom = frameShapeOf(starter)
      if (starter.shape) expect(FRAME_SHAPE_IDS).toContain(starter.shape)
      expect(TECHNIQUES).toContain(starter.weave.technique)
      expect(techniquesOf(starter), 'its shape supports its Technique').toContain(starter.weave.technique)
      const ids = starter.sizes.map((size) => size.id)
      expect(new Set(ids).size).toBe(ids.length)
      if (starter.measure === 'frame') {
        expect(ids).toEqual(expect.arrayContaining(custom!.settings.map((setting) => setting.id)))
      } else {
        expect(custom).toBeUndefined()
        expect(ids).toEqual(starter.measure === 'ring' ? ['width', 'ringSize'] : ['width', 'wrist'])
      }
      if (starter.measure === 'band') expect(Object.keys(BAND_EASE_MM)).toEqual(expect.arrayContaining([...starter.picks.find((pick) => pick.id === 'fit')!.values]))
      for (const size of starter.sizes) {
        expect(size.labelKey, `${size.id}'s words`).toEqual(expect.any(String))
        expect(size.step, `${size.id}'s step`).toBeGreaterThan(0)
        expect(size.default, `${size.id}'s default`).toBeGreaterThanOrEqual(size.min)
        expect(size.default, `${size.id}'s default`).toBeLessThanOrEqual(size.max)
      }
      for (const pick of starter.picks) {
        expect(pick.values).toContain(pick.default)
        if (pick.before) expect(ids).toContain(pick.before)
      }
    })
  }
})

describe('a new Project from a Starter', () => {
  it('puts the design in place in the Frame, named as asked, on the chosen Bead', () => {
    const project = starterProject(starterById('triangle'), { name: 'Sun', beadId, ...asDesigned('triangle') })
    expect(layersView(project)).toMatchObject({ name: 'Sun', beadId, frame: { shape: 'triangle', settings: { rounds: 10 } } })
    expect(frameOf(project)!.beads).toEqual(starterDesign(starterById('triangle')))
    expect(beadsOfLayer(project, 'canvas')).toEqual({})
  })

  it('puts the same Frame in place empty when it starts empty, or at another size', () => {
    expect(frameOf(starterProject(starterById('star'), { name: 'Star', beadId, sizes: { partSize: 5 }, useDesign: false }))).toMatchObject({ shape: 'star', settings: { partSize: 5 }, beads: {} })
    expect(frameOf(starterProject(starterById('star'), { name: 'Star', beadId, sizes: { partSize: 7 }, useDesign: true }))).toMatchObject({ settings: { partSize: 7 }, beads: {} })
  })

  it('starts a round shape on a Delica 11/0, packed by it, its rectangle covering its layout a bead to a cell (ticket 0723)', () => {
    expect(STARTER_BEAD_ID).toBe(beadId)
    for (const id of ['triangle', 'warpedSquare', 'star', 'kaleidocycle'] as const) {
      const starter = starterById(id)
      const project = starterProject(starter, { name: 'Piece', beadId: STARTER_BEAD_ID, ...asDesigned(id) })
      expect(frameOf(project)).toMatchObject({ beadId, ...starterFrameSize(starter, asDesigned(id), delica) })
      const geometry = frameGeometryOf(project)
      const place = geometry.place(geometry.positions()[0]!)!
      expect(place.box.width).toBeCloseTo(1, 9)
      expect(place.box.height).toBeCloseTo(1.6 / 1.3, 9)
      // Added to a Project in a Cube, it is laid out in the Delica it is given.
      const added = placedStarter(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 40, height: 40, unit: 'beads' } }), starter, { ...asDesigned(id), beadId }, { row: 20, column: 20 })
      expect(frameOf((added as { project: typeof project }).project)).toMatchObject(starterFrameSize(starter, asDesigned(id), delica))
    }
  })

  it('stands a shape as it is charted (ticket 0872): its peyote Canvas upright, not turned the quarter peyote starts with, and its Frame unturned', () => {
    for (const id of ['triangle', 'warpedSquare', 'kite', 'star', 'kaleidocycle'] as const) {
      const project = starterProject(starterById(id), { name: 'Piece', beadId, ...asDesigned(id) })
      expect(layersView(project), id).toMatchObject({ technique: 'peyote', orientation: 0 })
      expect(frameOf(project)!.quarterTurns, id).toBeUndefined()
    }
  })

  it('opens a Fringe earring as its Technique\'s Canvas starts, laid in its lines: brick stitch upright, peyote turned', () => {
    expect(canvasOf(starterProject(starterById('vFringe'), { name: 'Drop', beadId, ...asDesigned('vFringe') })).orientation).toBe(0)
    const peyote = starterProject(starterById('vFringe'), { name: 'Drop', beadId, ...asDesigned('vFringe'), weave: { technique: 'peyote' } })
    expect(canvasOf(peyote).orientation).toBe(90)
    expect(frameOf(peyote)!.quarterTurns).toBeUndefined()
  })

  it('records nothing of the Starter', () => {
    for (const id of ['kite', 'vFringe', 'bandPlaid'] as const) {
      expect(JSON.stringify(starterProject(starterById(id), { name: 'Piece', beadId, ...asDesigned(id) }))).not.toMatch(/starter/i)
    }
  })
})

describe('the Frame\'s Layer settings from a Starter\'s setup (ADR 0079, ticket 0671)', () => {
  const toho = 'toho/cube/1.5mm'
  const set = { beadId: toho, background: '#123456' }

  it('gives a new Project\'s Frame the setup\'s Weave, Bead and Background, and the Canvas copies them', () => {
    const project = starterProject(starterById('bandStripes'), { name: 'Band', ...asDesigned('bandStripes'), weave: { technique: 'loom' }, ...set })
    for (const layer of [canvasOf(project), frameOf(project)!]) {
      expect(layer).toMatchObject({ technique: 'loom', beadId: toho, background: '#123456' })
    }
  })

  it('on an open Project sets only the Frame: the Canvas keeps its Weave, Bead and Background', () => {
    const open = withBackground(createProject({ technique: 'loom', beadId, name: 'Open' }), 'canvas', 2)
    const result = placedStarter(open, starterById('triangle'), { ...asDesigned('triangle'), ...set }, { row: 20, column: 20 })
    if (result.kind !== 'changed') throw new Error(result.kind)
    expect(frameOf(result.project)).toMatchObject({ shape: 'triangle', technique: 'peyote', beadId: toho, background: '#123456' })
    expect(frameOf(result.project)!.beads).toEqual(starterDesign(starterById('triangle')))
    expect(canvasOf(result.project)).toEqual(canvasOf(open))
  })

  it('replaces a Frame\'s own Bead and Background with the setup\'s', () => {
    const open = createProject({ technique: 'peyote', beadId, name: 'Open', size: { unit: 'beads', width: 10, height: 10 } })
    const framed = withBackground(open, 'frame', 4)
    const result = placedStarter(framed, starterById('kite'), { ...asDesigned('kite'), ...set }, { row: 30, column: 30 })
    if (result.kind !== 'changed') throw new Error(result.kind)
    expect(frameOf(result.project)).toMatchObject({ shape: 'kite', beadId: toho, background: '#123456' })
  })

  it('measures a Ring\'s length in the setup\'s Bead, not the Project\'s', () => {
    const open = createProject({ technique: 'loom', beadId, name: 'Open' })
    const result = placedStarter(open, starterById('ringStripes'), { sizes: { width: 7, ringSize: 54 }, useDesign: false, ...set }, { row: 50, column: 50 })
    if (result.kind !== 'changed') throw new Error(result.kind)
    // 58 mm of 1.5 mm cubes: 39 rows.
    expect(frameSheetOf(result.project)).toMatchObject({ rows: 39, columns: 7 })
  })

  it('sizes and counts a Starter in the Technique the setup chose', () => {
    const ring = { sizes: { width: 7, ringSize: 54 }, useDesign: false }
    // Peyote counts each row twice round; loom once.
    expect(starterMeasure(starterById('ringStripes'), { ...ring, weave: { technique: 'loom' } }, delica)).toMatchObject({ rows: 36 })
    expect(starterBeadCount(starterById('ringStripes'), { ...ring, weave: { technique: 'loom' } }, delica)).toBe(252)
    expect(starterBeadCount(starterById('triangle'), { ...asDesigned('triangle'), weave: { technique: 'peyote' } }, delica)).toBe(165)
  })
})

describe('an Earring Starter (ticket 0597)', () => {
  it('is a brick-stitch Fringe earring of its top and fringe, its Fringe style the design\'s: the V fringe 87 beads', () => {
    const project = starterProject(starterById('vFringe'), { name: 'Drop', beadId, ...asDesigned('vFringe') })
    expect(layersView(project)).toMatchObject({ technique: 'brick', frame: { shape: 'fringeEarring', technique: 'brick', settings: { topWidth: 7, topRows: 6, fringeStyle: 'v', fringeLength: 12 } } })
    expect(frameOf(project)!.beads).toEqual(starterDesign(starterById('vFringe')))
    expect(starterBeadCount(starterById('vFringe'), asDesigned('vFringe'), delica)).toBe(87)
    expect(starterBeadCount(starterById('straightFringe'), asDesigned('straightFringe'), delica)).toBe(97)
  })

  it('puts the same earring in place empty at another length, or with the other Fringe style', () => {
    const straight = starterById('straightFringe')
    expect(frameOf(starterProject(straight, { name: 'Drop', beadId, sizes: { fringeLength: 12 }, useDesign: true }))).toMatchObject({ settings: { fringeStyle: 'straight', fringeLength: 12 }, beads: {} })
    expect(frameOf(starterProject(straight, { name: 'Drop', beadId, sizes: {}, picks: { fringeStyle: 'v' }, useDesign: true }))).toMatchObject({ settings: { fringeStyle: 'v' }, beads: {} })
    expect(designDifferences(straight, { sizes: { fringeLength: 12 }, picks: { fringeStyle: 'v' } })).toEqual([{ size: straight.sizes[2] }, { pick: straight.picks[0] }])
  })

  it('offers Top rows past its point, a brick body two rows at a time, and keeps the body as tall when the Width changes (ticket 0814)', () => {
    const straight = starterById('straightFringe')
    // A Width of 6 tapers to a pair in 5 rows; the highest body up to 60 Top rows is 54 rows.
    expect(starterSizeRanges(straight, { topWidth: 6 }).topRows).toEqual({ min: 1, max: 59 })
    expect(starterSizeRanges(straight, {}).topWidth).toEqual({ min: 2, max: 30 })
    expect(sizesWith(straight, { topWidth: 7, topRows: 6 }, 'topRows', 7)).toMatchObject({ topWidth: 7, topRows: 8 })
    expect(sizesWith(straight, { topWidth: 7, topRows: 8 }, 'topRows', 7)).toMatchObject({ topRows: 6 })
    expect(sizesWith(straight, { topWidth: 7, topRows: 8 }, 'topWidth', 9)).toMatchObject({ topWidth: 9, topRows: 10 })
  })

  it('moves a V fringe\'s length with its Width, as the style picked has it (ticket 0816)', () => {
    const v = starterById('vFringe')
    expect(sizesWith(v, { topWidth: 7, fringeLength: 12 }, 'topWidth', 9)).toMatchObject({ topWidth: 9, fringeLength: 14 })
    expect(sizesWith(v, { topWidth: 7, fringeLength: 12 }, 'topWidth', 9, v.weave, { fringeStyle: 'straight' })).toMatchObject({ topWidth: 9, fringeLength: 12 })
    expect(sizesWith(starterById('straightFringe'), { topWidth: 7, fringeLength: 12 }, 'topWidth', 9, undefined, { fringeStyle: 'v' })).toMatchObject({ fringeLength: 14 })
  })
})

describe('a Ring or Band Starter (ticket 0597)', () => {
  const toho = findBead('toho-cube-1.5mm')!
  const ringAt = (ringSize: number) => ({ sizes: { width: 7, ringSize }, useDesign: false })

  it('is woven across its width in peyote, its length in rows of the Bead and its Width in columns: a 54 mm Ring 7 wide is 36 beads long (ticket 0832)', () => {
    // EU 54 is 54 mm round; 58 mm of Delica 11/0 on their sides, 1.6 mm a row, is 36 rows, each two lines of the zig-zag.
    expect(starterFrameSize(starterById('ringStripes'), ringAt(54), delica)).toEqual({ rows: 36, columns: 7 })
    const measure = starterMeasure(starterById('ringStripes'), ringAt(54), delica)
    expect(measure).toMatchObject({ shape: 'ring', insideMm: 54 / Math.PI, rows: 72 })
    expect(measure.widthMm).toBeCloseTo(9.1)
    expect(starterBeadCount(starterById('ringStripes'), ringAt(54), delica)).toBe(252)
  })

  it('lies across on a new Project: the Canvas turned the quarter a peyote Project starts with, the Frame unturned', () => {
    const project = starterProject(starterById('ringStripes'), { name: 'Ring', beadId, ...asDesigned('ringStripes') })
    expect(layersView(project)).toMatchObject({ technique: 'peyote', orientation: 90, frame: { rows: 36, columns: 7, technique: 'peyote' } })
    expect(frameOf(project)!.quarterTurns).toBeUndefined()
  })

  it('lies the way each Technique works a strip: loom as peyote on a Canvas turned a quarter, brick stitch along its rows unturned', () => {
    const loom = { ...ringAt(54), weave: { technique: 'loom' as const } }
    expect(starterFrameSize(starterById('ringStripes'), loom, delica)).toEqual({ rows: 36, columns: 7 })
    expect(layersView(starterProject(starterById('ringStripes'), { name: 'Ring', beadId, ...loom }))).toMatchObject({ technique: 'loom', orientation: 90, frame: { rows: 36, columns: 7 } })
    const brick = { ...ringAt(54), weave: { technique: 'brick' as const } }
    expect(starterFrameSize(starterById('ringStripes'), brick, delica)).toEqual({ rows: 7, columns: 36 })
    expect(starterMeasure(starterById('ringStripes'), brick, delica)).toMatchObject({ widthMm: 7 * 1.3, rows: 72 })
    expect(layersView(starterProject(starterById('ringStripes'), { name: 'Ring', beadId, ...brick }))).toMatchObject({ technique: 'brick', orientation: 0, frame: { rows: 7, columns: 36 } })
  })

  it('lays its design in brick stitch with its rows as columns, the stagger in register: the lying peyote strip in a mirror', () => {
    const ring = starterById('ringChevrons')
    const design = starterDesign(ring)
    const beads = frameOf(starterProject(ring, { name: 'Ring', beadId, ...asDesigned('ringChevrons'), weave: { technique: 'brick' } }))!.beads
    expect(beadCount(beads)).toBe(252)
    expect(beads[0]![0]).toBe(design[0]![0])
    expect(beads[6]![0]).toBe(design[0]![6])
    expect(beads[2]![35]).toBe(design[35]![2])
    // An odd line's bead sits half a bead further along the strip than the even lines' in both: peyote's odd column
    // hangs half a row down, brick's odd row half a bead across.
    expect(beads[1]![4]).toBe(design[4]![1])
  })

  it('makes a Band of the wrist and its Fit\'s ease, less 1.5 cm for the clasp', () => {
    // A 16 cm wrist, Comfortable (1.5 cm) less the clasp: 160 mm, 100 rows of 1.6 mm, 200 lines.
    const comfortable = { sizes: { width: 11, wrist: 16 }, useDesign: false }
    expect(starterFrameSize(starterById('bandStripes'), comfortable, delica)).toEqual({ rows: 100, columns: 11 })
    expect(starterMeasure(starterById('bandStripes'), comfortable, delica)).toMatchObject({ shape: 'band', lengthMm: 160, rows: 200 })
    expect(starterFrameSize(starterById('bandStripes'), { ...comfortable, picks: { fit: 'snug' } }, delica).rows).toBe(97)
    expect(starterFrameSize(starterById('bandStripes'), { ...comfortable, picks: { fit: 'loose' } }, delica).rows).toBe(103)
    expect(starterFrameSize(starterById('bandStripes'), comfortable, toho).rows).toBe(107)
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
    expect(frameOf(project)).toMatchObject({ rows: 100, columns: 11, technique: 'peyote' })
    expect(frameOf(project)!.beads).toEqual(starterDesign(starterById('bandDiamonds')))
  })
})

describe('a Starter put on an open Project', () => {
  const open = createProject({ technique: 'loom', beadId, name: 'Open' })

  it('puts the design in place round the centre, over the Canvas, Row progress at the first pass', () => {
    const painted = withLayers(open, { beads: { 3: { 3: '#00ff00' } } })
    const result = placedStarter(painted, starterById('warpedSquare'), asDesigned('warpedSquare'), { row: 20, column: 30 })
    if (result.kind !== 'changed') throw new Error(result.kind)
    expect(frameOf(result.project)).toMatchObject({ shape: 'warpedSquare', settings: { rounds: 8 } })
    expect(frameOf(result.project)!.beads).toEqual(starterDesign(starterById('warpedSquare')))
    expect(beadsOfLayer(result.project, 'canvas')).toBe(beadsOfLayer(painted, 'canvas'))
    expect(canvasOf(result.project).technique).toBe('loom')
  })

  it('is the same Frame as an empty Custom frame of that Frame shape and size', () => {
    const frameOf = (result: FrameChangeResult) => (result.kind === 'changed' ? frameSheetOf(result.project) : undefined)
    const empty = frameOf(placedStarter(open, starterById('kaleidocycle'), { sizes: { partSize: 9 }, useDesign: false }, { row: 0, column: 0 }))
    expect(empty).toMatchObject({ shape: 'kaleidocycle', beads: {} })
    expect(empty).toEqual(frameOf(changeFrame(open, { custom: { shape: 'kaleidocycle', size: 9, centre: { row: 0, column: 0 } } })))
  })

  it('puts a Ring in place through the Frame change that places any Frame, holding its design', () => {
    const ring = starterById('ringDiamonds')
    const frameOf = (result: FrameChangeResult) => (result.kind === 'changed' ? frameSheetOf(result.project) : undefined)
    const turned = rotateCanvas(open)
    const frame = { row: 32, column: 47, rows: 36, columns: 7 }
    const placed = frameOf(changeFrame(turned, { place: { frame, weave: weaveOf({ technique: 'peyote' }), beads: starterDesign(ring) } }))
    expect(placed?.beads).toEqual(starterDesign(ring))
    expect(frameOf(placedStarter(turned, ring, asDesigned('ringDiamonds'), { row: 50, column: 50 }))).toEqual(placed)
  })

  it('lays a Ring across on an unturned Canvas too (ticket 0832): its Frame turned a quarter round the centre, in its own Technique', () => {
    const result = placedStarter(open, starterById('ringDiamonds'), asDesigned('ringDiamonds'), { row: 50, column: 50 })
    if (result.kind !== 'changed') throw new Error(result.kind)
    const frame = frameOf(result.project)!
    expect(frame).toMatchObject({ rows: 36, columns: 7, technique: 'peyote', quarterTurns: 1 })
    // As it lies it covers 6 rows of 45 columns of its own cells, round row 50, column 50.
    expect(laidFrame(result.project)).toMatchObject({ row: 47, column: 28, rows: 6, columns: 45 })
    expect(settingsOf(frame)).toBeUndefined()
    expect(frame.beads).toEqual(starterDesign(starterById('ringDiamonds')))
    expect(canvasOf(result.project).technique).toBe('loom')
  })

  it('turns the Frame by what the Canvas lacks, so the strip reads as its Starter shows it at any quarter', () => {
    const turnsOn = (project: typeof open, technique: 'peyote' | 'brick') => {
      const result = placedStarter(project, starterById('ringDiamonds'), { ...asDesigned('ringDiamonds'), weave: { technique } }, { row: 50, column: 50 })
      return result.kind === 'changed' ? (frameOf(result.project)!.quarterTurns ?? 0) : undefined
    }
    const [quarter, half] = [rotateCanvas(open), rotateCanvas(rotateCanvas(open))]
    expect([open, quarter, half].map((project) => turnsOn(project, 'peyote'))).toEqual([1, 0, 3])
    expect([open, quarter, half].map((project) => turnsOn(project, 'brick'))).toEqual([0, 3, 2])
  })

  it('turns a shape by what the Canvas lacks, so it stands as charted at any quarter, and Rotate Frame turns it on from there (ticket 0872)', () => {
    const turnsOf = (project: typeof open, id: 'triangle' | 'vFringe') => {
      const result = placedStarter(project, starterById(id), asDesigned(id), { row: 50, column: 50 })
      return result.kind === 'changed' ? result.project : undefined
    }
    const peyote = createProject({ technique: 'peyote', beadId, name: 'Open' })
    const canvases = [open, rotateCanvas(open), rotateCanvas(rotateCanvas(open)), peyote]
    expect(canvases.map((project) => frameOf(turnsOf(project, 'triangle')!)!.quarterTurns ?? 0)).toEqual([0, 3, 2, 3])
    // A Fringe earring is laid in its Technique's lines, so it lies as the Canvas shows them.
    expect(canvases.map((project) => frameOf(turnsOf(project, 'vFringe')!)!.quarterTurns ?? 0)).toEqual([0, 0, 0, 0])
    const placed = turnsOf(peyote, 'triangle')!
    expect(frameOf(placed)!.beads).toEqual(starterDesign(starterById('triangle')))
    expect(frameOf(turnedCustomFrame(placed)!)!.quarterTurns).toBeUndefined()
  })
})

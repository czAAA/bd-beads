import { describe, expect, it } from 'vitest'
import { beadCount } from './canvas'
import { changeFrame, type FrameChangeResult } from './changeFrame'
import { frameLayoutOf, frameSizeOf } from './frameKind'
import { createProject } from './project'
import { placedStarter, STARTER_CATEGORIES, starterBeadCount, starterById, starterDesign, starterProject } from './starters'

const beadId = 'miyuki/delica/11-0'

describe('the Starter registry', () => {
  it('has the Shapes, the Star its best design', () => {
    expect(STARTER_CATEGORIES.map((category) => category.id)).toEqual(['shapes'])
    expect(STARTER_CATEGORIES[0]!.starters.map((starter) => starter.id)).toEqual(['triangle', 'warpedSquare', 'kite', 'star', 'kaleidocycle'])
    expect(STARTER_CATEGORIES[0]!.best.id).toBe('star')
  })

  it('makes each design for its own size: a Triangle of 10 rounds holds 165 beads, a Warped Square of 8 holds 144', () => {
    expect(starterById('triangle').size).toBe(10)
    expect(starterBeadCount(starterById('triangle'), 10)).toBe(165)
    expect(starterBeadCount(starterById('warpedSquare'), 8)).toBe(144)
  })

  for (const starter of STARTER_CATEGORIES.flatMap((category) => category.starters)) {
    it(`keeps the ${starter.id} design's beads on its layout, every position painted`, () => {
      const layout = frameLayoutOf({ kind: starter.kind, settings: { [starter.setting]: starter.size } })!
      const beads = starterDesign(starter)
      expect(beadCount(beads)).toBe(layout.positions.length)
      for (const { row, column } of layout.positions) expect(beads[row]?.[column]).toMatch(/^#[0-9a-f]{6}$/)
    })

    it(`offers the ${starter.id} design's size among its chips, every chip within the kind's range`, () => {
      expect(starter.presets).toContain(starter.size)
      for (const preset of starter.presets) expect(frameSizeOf({ kind: starter.kind, settings: { [starter.setting]: preset } })).toBe(preset)
    })
  }
})

describe('a new Project from a Starter', () => {
  it('puts the design in place in the Frame, named as asked, on the chosen Bead', () => {
    const project = starterProject(starterById('triangle'), { name: 'Sun', beadId, size: 10, useDesign: true })
    expect(project).toMatchObject({ name: 'Sun', beadId, frame: { kind: 'triangle', settings: { rounds: 10 } } })
    expect(project.frame!.beads).toEqual(starterDesign(starterById('triangle')))
    expect(project.beads).toEqual({})
  })

  it('puts the same Frame in place empty when it starts empty, or at another size', () => {
    expect(starterProject(starterById('star'), { name: 'Star', beadId, size: 5, useDesign: false }).frame).toMatchObject({ kind: 'star', settings: { partSize: 5 }, beads: {} })
    expect(starterProject(starterById('star'), { name: 'Star', beadId, size: 7, useDesign: true }).frame).toMatchObject({ settings: { partSize: 7 }, beads: {} })
  })

  it('records nothing of the Starter', () => {
    const project = starterProject(starterById('kite'), { name: 'Kite', beadId, size: starterById('kite').size, useDesign: true })
    expect(JSON.stringify(project)).not.toMatch(/starter/i)
  })
})

describe('a Starter put on an open Project', () => {
  const open = createProject({ technique: 'loom', beadId, name: 'Open' })

  it('puts the design in place round the centre, over the Canvas, Row progress at the first pass', () => {
    const painted = { ...open, beads: { 3: { 3: '#00ff00' } } }
    const result = placedStarter(painted, starterById('warpedSquare'), { size: 8, useDesign: true }, { row: 20, column: 30 })
    if (result.kind !== 'changed') throw new Error(result.kind)
    expect(result.project.frame).toMatchObject({ kind: 'warpedSquare', settings: { rounds: 8 } })
    expect(result.project.frame!.beads).toEqual(starterDesign(starterById('warpedSquare')))
    expect(result.project.beads).toBe(painted.beads)
    expect(result.project.technique).toBe('loom')
  })

  it('is the same Frame as an empty Custom frame of that kind and size', () => {
    const frameOf = (result: FrameChangeResult) => (result.kind === 'changed' ? result.project.frame : undefined)
    const empty = frameOf(placedStarter(open, starterById('kaleidocycle'), { size: 9, useDesign: false }, { row: 0, column: 0 }))
    expect(empty).toMatchObject({ kind: 'kaleidocycle', beads: {} })
    expect(empty).toEqual(frameOf(changeFrame(open, { custom: { kind: 'kaleidocycle', size: 9, centre: { row: 0, column: 0 } } })))
  })
})

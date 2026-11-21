// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadCount, forEachBead, withColors, type BeadMap } from './canvas'
import { fillArea } from './fill'
import { frameLayoutOf } from './frameShape'
import { onLayer } from './layers'
import { changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { framePlacement, linedUpAngle, linedUpFrame } from './framePlacement'
import { beadsOfLayer, canvasOf, frameOf, heldWeave, withLayer } from './layerRecord'
import type { Project } from './project'
import { rotateFrame, turnCanvasTo, twistFrameTo } from './rotate'
import { lieAlike } from './table'
import { neighborsOf, type Technique, type TechniqueSettings } from './weave'

// Remove frame lines the Frame up with the Canvas first (ticket 1189, spec 1182): the smallest turn that lays its beads
// on the Canvas's cells, a slide onto whole positions, then the upright drop, so it comes back as the very piece it was.

const beadId = 'miyuki/delica/11-0'

/** A Project in a Technique with its Frame of `width` by `height` beads moved off the origin, each of its cells a color
 * of its own, so where each bead lands can be told apart. */
function filled(technique: Technique, width: number, height: number, techniqueSettings?: TechniqueSettings): Project {
  const made = createProject({ technique, beadId, size: { width, height, unit: 'beads' }, ...(techniqueSettings ? { techniqueSettings } : {}) })
  const moved = changeFrame(made, { move: { rows: 8, columns: 12 } })
  const project = moved.kind === 'changed' ? moved.project : made
  const { rows, columns } = frameOf(project)!
  const cells = Array.from({ length: rows * columns }, (_, at) => ({ row: Math.floor(at / columns), column: at % columns, color: `#${at.toString(16).padStart(6, '0')}` }))
  return withLayer(project, 'frame', { beads: withColors({}, cells) })
}

function removed(project: Project): Project {
  const result = changeFrame(project, { remove: true })
  if (result.kind !== 'changed') throw new Error('expected the Frame removed')
  return result.project
}

/** Where each color lies in a bead map. */
function placesOf(beads: BeadMap): Map<string, { row: number; column: number }> {
  const places = new Map<string, { row: number; column: number }>()
  forEachBead(beads, (row, column, color) => places.set(color, { row, column }))
  return places
}

/** Every bead of the Frame lands on the Canvas, and every two that touch in the Frame touch there: the same piece. */
function expectTheVeryPiece(before: Project, after: Project, label: string): void {
  const own = placesOf(beadsOfLayer(before, 'frame')!)
  const landed = placesOf(beadsOfLayer(after, 'canvas'))
  expect(landed.size, label).toBe(own.size)
  const frameWeave = heldWeave(before, 'frame')!
  const canvasWeave = heldWeave(after, 'canvas')
  const colorAt = new Map([...own].map(([color, at]) => [`${at.row},${at.column}`, color]))
  for (const [color, at] of own) {
    for (const next of neighborsOf(frameWeave, undefined, at)) {
      const other = colorAt.get(`${next.row},${next.column}`)
      if (!other) continue
      const [from, to] = [landed.get(color)!, landed.get(other)!]
      const touching = neighborsOf(canvasWeave, undefined, from).some(({ row, column }) => row === to.row && column === to.column)
      expect(touching, `${label}: ${color} and ${other}`).toBe(true)
    }
  }
}

describe('linedUpAngle (ticket 1189)', () => {
  it('turns a loom Frame to the nearest quarter of the Canvas\'s angle, never more than 45°', () => {
    const loom = filled('loom', 6, 4)
    expect([30, 44, 50, 100, 200, 300, 340].map((angle) => linedUpAngle(twistFrameTo(loom, angle)!))).toEqual([0, 0, 90, 90, 180, 270, 0])
    const leaning = turnCanvasTo(loom, 37)
    expect(linedUpAngle(twistFrameTo(leaning, 100)!)).toBe(127)
    expect(linedUpAngle(twistFrameTo(leaning, 20)!)).toBe(37)
  })

  it('turns a peyote or brick stitch Frame only to the Canvas\'s angle or a half turn off it, at most a quarter', () => {
    for (const technique of ['peyote', 'brick'] as const) {
      const project = filled(technique, 6, 4)
      const canvas = canvasOf(project).orientation
      const at = (off: number) => linedUpAngle(twistFrameTo(project, canvas + off)!)
      expect([at(30), at(80), at(100), at(200), at(260), at(280)], technique).toEqual([canvas, canvas, canvas + 180, canvas + 180, canvas + 180, canvas].map((angle) => angle % 360))
    }
  })
})

describe('linedUpFrame (ticket 1189)', () => {
  it('turns the Frame about its own centre and slides it onto whole Canvas positions, so it lies on the grid', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const leaning = twistFrameTo(filled(technique, 7, 5), canvasOf(filled(technique, 7, 5)).orientation + 23)!
      const lined = linedUpFrame(leaning)
      expect(lieAlike(lined), technique).toBe(true)
      const [was, now] = [framePlacement(leaning)!.at, framePlacement(lined)!.at]
      // Slid by less than a whole cycle of positions each way.
      expect(Math.abs(now.x - was.x), technique).toBeLessThan(2)
      expect(Math.abs(now.y - was.y), technique).toBeLessThan(2)
    }
  })

  it('leaves a Frame lying alike as it is', () => {
    const project = filled('peyote', 6, 4)
    expect(linedUpFrame(project)).toBe(project)
  })
})

describe('Remove frame after the line-up (ticket 1189)', () => {
  const pieces: [Technique, number, number, TechniqueSettings?][] = [
    ['loom', 6, 4],
    ['loom', 5, 3],
    ['peyote', 6, 4],
    ['peyote', 5, 3],
    ['peyote', 8, 5, { peyoteDrop: 2 }],
    ['brick', 6, 4],
    ['brick', 5, 3],
    ['brick', 6, 9, { brickDrop: 2 }],
  ]

  it('brings the same Technique back as the very piece it was from every quarter turn of Rotate Frame', () => {
    for (const [technique, width, height, settings] of pieces) {
      let project = filled(technique, width, height, settings)
      for (let turns = 0; turns < 4; turns += 1) {
        expectTheVeryPiece(project, removed(project), `${technique} ${width}×${height} turned ${turns}`)
        project = rotateFrame(project)!
      }
    }
  })

  it('brings it back as the very piece from leaning angles, the Frame\'s own or the Canvas\'s', () => {
    for (const [technique, width, height, settings] of pieces) {
      const project = filled(technique, width, height, settings)
      const canvas = canvasOf(project).orientation
      for (const off of [7, 44, 80, 100, 170, 215, 290, 333]) {
        expectTheVeryPiece(project, removed(twistFrameTo(project, canvas + off)!), `${technique} ${width}×${height} twisted ${off}°`)
        expectTheVeryPiece(project, removed(turnCanvasTo(project, canvas + off)), `${technique} ${width}×${height} under a Canvas turned ${off}°`)
      }
    }
  })

  it('drops a leaning Frame where Rotate Frame\'s turn nearest it would have, the same cells', () => {
    const project = filled('peyote', 6, 4)
    const half = rotateFrame(rotateFrame(project)!)!
    const canvas = canvasOf(project).orientation
    expect(beadsOfLayer(removed(twistFrameTo(project, canvas + 186)!), 'canvas')).toEqual(beadsOfLayer(removed(half), 'canvas'))
    expect(beadsOfLayer(removed(twistFrameTo(project, canvas + 7)!), 'canvas')).toEqual(beadsOfLayer(removed(project), 'canvas'))
  })

  it('re-weaves a Frame woven unlike the Canvas cell by cell, as from upright, every bead kept', () => {
    const loomCanvas = createProject({ technique: 'loom', beadId, size: { width: 6, height: 4, unit: 'beads' } })
    const peyote = changeFrame(loomCanvas, { technique: 'peyote', techniqueSettings: { peyoteDrop: 1 } })
    if (peyote.kind !== 'changed') throw new Error('expected the Frame rewoven')
    const { rows, columns } = frameOf(peyote.project)!
    const cells = Array.from({ length: rows * columns }, (_, at) => ({ row: Math.floor(at / columns), column: at % columns, color: `#${at.toString(16).padStart(6, '0')}` }))
    const project = withLayer(peyote.project, 'frame', { beads: withColors({}, cells) })
    const upright = beadsOfLayer(removed(project), 'canvas')
    expect(placesOf(upright).size).toBe(cells.length)
    expect(beadsOfLayer(removed(twistFrameTo(project, 12)!), 'canvas')).toEqual(upright)
    expect(placesOf(beadsOfLayer(removed(twistFrameTo(project, 170)!), 'canvas')).size).toBe(cells.length)
  })

  it('takes its Folded beads with it from a lean', () => {
    const project = filled('loom', 6, 4)
    const withFolded = { ...project, layers: [project.layers[0], { ...project.layers[1]!, folded: withColors({}, [{ row: 0, column: 6, color: '#ffffff' }]) }] } as Project
    const canvas = beadsOfLayer(removed(twistFrameTo(withFolded, 20)!), 'canvas')
    expect(placesOf(canvas).has('#ffffff')).toBe(true)
    expect(canvas).toEqual(beadsOfLayer(removed(withFolded), 'canvas'))
  })

  it('turns a Custom frame under a leaning Canvas to the nearest quarter, then drops each bead nearest its centre, none lost', () => {
    const open = createProject({ technique: 'loom', beadId, name: 'Open' })
    const placed = changeFrame(open, { custom: { shape: 'triangle', size: 4, centre: { row: 20, column: 30 } } })
    if (placed.kind !== 'changed') throw new Error('expected a triangle')
    const project = onLayer(placed.project, 'frame', (view) => fillArea(view, 0, 0, '#e63746'))
    const leaning = turnCanvasTo(project, 30)
    expect(lieAlike(leaning)).toBe(false)
    expect(lieAlike(linedUpFrame(leaning))).toBe(true)
    expect(beadCount(beadsOfLayer(removed(leaning), 'canvas'))).toBe(frameLayoutOf(frameOf(project)!)!.positions.length)
  })
})

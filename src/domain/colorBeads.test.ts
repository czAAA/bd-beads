// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { BeadMap } from './canvas'
import { changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { beadsInColors, withBeadsBackIn, withoutBeadsIn } from './colorBeads'
import type { FrameLayer, Project } from './project'

const RED = '#aa0000'
const BLUE = '#0000aa'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 6, height: 6, unit: 'beads' } })

/** The base Project with a Frame on its top-left corner, the Canvas, the Frame and its Folded beads holding these. */
function framed(canvas: BeadMap, frame: BeadMap, folded?: BeadMap): Project {
  const made = changeFrame(base, { make: { row: 0, column: 0, rows: 2, columns: 2 } })
  if (made.kind !== 'changed') throw new Error('no Frame')
  const [, sheet] = made.project.layers as [unknown, FrameLayer]
  return { ...made.project, layers: [{ ...made.project.layers[0], beads: canvas }, { ...sheet, beads: frame, ...(folded ? { folded } : {}) }] }
}

describe('the beads painted in some colors (ticket 1124)', () => {
  const project = framed({ 4: { 4: RED, 5: BLUE } }, { 0: { 0: RED } }, { 3: { 0: RED } })

  it('counts the beads in them on both layers, the Folded ones too', () => {
    expect(beadsInColors(project, new Set([RED]))).toBe(3)
    expect(beadsInColors(project, new Set([RED, BLUE]))).toBe(4)
    expect(beadsInColors(project, new Set(['#123456']))).toBe(0)
  })

  it('takes them off every layer and the Folded beads, leaving the other colors', () => {
    const without = withoutBeadsIn(project, new Set([RED]))
    expect(without.layers[0].beads).toEqual({ 4: { 5: BLUE } })
    expect(without.layers[1]!.beads).toEqual({})
    expect((without.layers[1] as FrameLayer).folded).toBeUndefined()
  })

  it('is the same Project when none is painted in them', () => {
    expect(withoutBeadsIn(project, new Set(['#123456']))).toBe(project)
    expect(withoutBeadsIn(project, new Set())).toBe(project)
  })

  it('puts them back where their places are still empty, the Folded ones too', () => {
    const without = withoutBeadsIn(project, new Set([RED]))
    const drawnSince = { ...without, layers: [{ ...without.layers[0], beads: { 4: { 4: BLUE, 5: BLUE } } }, without.layers[1]!] } as Project
    const back = withBeadsBackIn(drawnSince, project, new Set([RED]))
    expect(back.layers[0].beads).toEqual({ 4: { 4: BLUE, 5: BLUE } })
    expect(back.layers[1]!.beads).toEqual({ 0: { 0: RED } })
    expect((back.layers[1] as FrameLayer).folded).toEqual({ 3: { 0: RED } })
  })

  it('puts none back on a layer gone since', () => {
    const removed = changeFrame(withoutBeadsIn(project, new Set([RED])), { remove: true })
    if (removed.kind !== 'changed') throw new Error('Frame not removed')
    const back = withBeadsBackIn(removed.project, project, new Set([RED]))
    expect(back.layers).toHaveLength(1)
    expect(back.layers[0].beads).toEqual({ 4: { 4: RED, 5: BLUE } })
  })
})

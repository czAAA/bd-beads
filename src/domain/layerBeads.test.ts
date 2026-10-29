// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { withFrame } from './frame'
import { beadColorAt, hasProjectBeads, projectColors, sameBeads } from './layerBeads'
import { BEAD_CATALOG } from './beads'
import { beadsOfLayer, frameOf } from './layerRecord'
import { withFields } from '../testUtils/flatFields'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

describe('the Frame as its own sheet (ADR 0066)', () => {
  const sheet = () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    return withFields(base, { frame: { ...frameOf(base)!, row: 10, column: 10, beads: { 0: { 0: '#111111' }, 2: { 3: '#222222' } } }, beads: { 10: { 10: '#999999' }, 50: { 50: '#333333' } } })
  }

  it('shows the Frame\'s bead where it lies over the Canvas, and the Canvas\'s elsewhere', () => {
    const project = sheet()
    expect(beadColorAt(project, 10, 10)).toBe('#111111')
    expect(beadColorAt(project, 11, 10)).toBeNull()
    expect(beadColorAt(project, 50, 50)).toBe('#333333')
  })

  it('resizes with the beads staying where they are on the Canvas, dropping those outside, and leaves the Canvas alone', () => {
    const project = sheet()
    const moved = withFrame(project, { row: 9, column: 9, rows: 3, columns: 4 })
    expect(frameOf(moved)!.beads).toEqual({ 1: { 1: '#111111' } })
    expect(beadsOfLayer(moved, 'canvas')).toBe(beadsOfLayer(project, 'canvas'))
  })

  it('removes the Frame\'s beads with it', () => {
    const removed = withFrame(sheet(), undefined)
    expect(frameOf(removed)).toBeUndefined()
    expect(beadsOfLayer(removed, 'canvas')).toEqual(beadsOfLayer(sheet(), 'canvas'))
  })

  it('knows a bead on either layer, and every color of both', () => {
    const project = sheet()
    expect(hasProjectBeads(project)).toBe(true)
    expect(hasProjectBeads(withFields(project, { beads: {}, frame: { ...frameOf(project)!, beads: {} } }))).toBe(false)
    expect(hasProjectBeads(withFields(project, { beads: {} }))).toBe(true)
    expect(projectColors(project).sort()).toEqual(['#111111', '#222222', '#333333', '#999999'])
  })

  it('tells two states of a Project apart by the beads of either layer, not by which object holds them', () => {
    const project = sheet()
    expect(sameBeads(project, withFields(project, { beads: { ...beadsOfLayer(project, 'canvas') }, frame: { ...frameOf(project)!, beads: { ...frameOf(project)!.beads } } }))).toBe(true)
    expect(sameBeads(project, withFields(project, { beads: {} }))).toBe(false)
    expect(sameBeads(project, withFields(project, { frame: { ...frameOf(project)!, beads: {} } }))).toBe(false)
  })
})

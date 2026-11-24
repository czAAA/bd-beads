import { frameIdIn, FRAME_ID } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import type { BeadMap } from '../domain/canvas'
import { frameOf } from '../domain/layerRecord'
import type { Project } from '../domain/project'
import { withLayers } from '../testUtils/layerFields'
import { recordingContext } from '../testUtils/recordingContext'
import { DEFAULT_THEME } from './beadLook'
import { renderOverlay } from './overlayRenderer'
import { renderProject } from './projectRenderer'
import { rulerLayout, rulersOf } from './rulers'
import { spaceOf } from './space'
import { surfaceView, type ViewLayer } from './surfaceView'

// The editor's two stacked surfaces (ticket 1187): each layer's part drawn alone, which together are what both draw.

const RED = '#e63746'

/** An open Canvas with beads round a 6 × 6 Frame of beads, its Row progress shown. */
function framed(): Project {
  const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 6, height: 6, unit: 'beads' } })
  const frame = frameOf(project)!
  const own: BeadMap = {}
  for (let row = 0; row < 6; row += 1) own[row] = Object.fromEntries(Array.from({ length: 6 }, (_, column) => [column, RED]))
  const canvas: BeadMap = { [frame.row - 8]: { [frame.column]: RED } }
  return withLayers(project, { beads: canvas, frame: { ...frame, beads: own } })
}

const project = framed()
const space = spaceOf(project, true, frameIdIn(project))
const frame = frameOf(project)!
const view = surfaceView({ space, technique: 'loom', frame, rotation: 0, zoom: 1, scroll: { x: frame.column * 20 - 200, y: frame.row * 20 - 200 }, viewport: { width: 600, height: 600 } })
const region = { x: frame.column * 20 - 200, y: frame.row * 20 - 200, width: 600, height: 600 }

/** The margin sheet's paper filled. */
const sheetFill = (call: { name: string; fillStyle?: unknown }) => call.name === 'fill' && call.fillStyle === DEFAULT_THEME.margin.fill

function drawn(layer?: ViewLayer) {
  const { context, calls } = recordingContext()
  renderProject(context, { project, space, region, zoom: 1, theme: DEFAULT_THEME, opaque: true, rowMarks: true, layer })
  return calls
}

describe("each layer's part of the beads (ticket 1187)", () => {
  it("leaves the Frame's surface clear round its sheet: no Background, no Position marks", () => {
    const calls = drawn(FRAME_ID)
    expect(calls.filter((call) => call.name === 'fillRect' && call.fillStyle === DEFAULT_THEME.canvas)).toHaveLength(0)
    expect(calls.some(sheetFill)).toBe(true)
  })

  it("draws the Canvas's Background on its own surface and leaves the Frame's sheet out", () => {
    const calls = drawn('canvas')
    expect(calls.some((call) => call.name === 'fillRect' && call.fillStyle === DEFAULT_THEME.canvas)).toBe(true)
    expect(calls.some(sheetFill)).toBe(false)
  })

  it('draws as much between them as both together draw', () => {
    const count = (calls: ReturnType<typeof drawn>, name: string) => calls.filter((call) => call.name === name).length
    for (const name of ['roundRect', 'drawImage', 'fill']) {
      expect(count(drawn('canvas'), name) + count(drawn(FRAME_ID), name)).toBe(count(drawn(), name))
    }
  })
})

describe("each layer's part of the overlay (ticket 1187)", () => {
  const layout = rulerLayout(project, view, { fontPx: 11, numbers: true }, frameIdIn(project))
  function overlay(layer?: ViewLayer) {
    const { context, calls } = recordingContext()
    renderOverlay(context, { project, space, region, zoom: 1, rowMarks: true, rulers: { layout, surface: view }, layer })
    return calls
  }

  it("draws the Frame's Row progress and rulers on its own surface, none on the Canvas's", () => {
    const text = (calls: ReturnType<typeof overlay>) => calls.filter((call) => call.name === 'fillText').length
    expect(text(overlay(FRAME_ID))).toBe(text(overlay()))
    expect(text(overlay('canvas'))).toBe(0)
    expect(overlay('canvas').filter((call) => call.name === 'stroke')).toHaveLength(0)
  })

  it('splits a ruler layout by the kind of box it carries', () => {
    const own = rulersOf(layout, 'frame')
    expect(own.labels.length).toBe(layout.labels.filter((label) => label.kind === 'frame').length)
    expect(own.labels.length).toBeGreaterThan(0)
    const pieces = rulersOf(layout, 'piece')
    expect(pieces.labels.every((label) => label.kind === 'piece')).toBe(true)
    expect(pieces.passMark).toBe(false)
  })
})

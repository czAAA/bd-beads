import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import type { Project } from '../domain/project'
import { drawBeadLetter, LETTER_ON_DARK, LETTER_ON_LIGHT, LIGHT_THEME, type DrawingContext } from './beadLook'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import { frameOf } from '../domain/layerRecord'
import { withLayers } from '../testUtils/layerFields'

/** A context that records the text drawn and the color it was drawn in. */
function recordingContext() {
  const drawn: { text: string; fill: string }[] = []
  const noop = () => undefined
  const context: Record<string, unknown> & { fillStyle: unknown } = {
    save: noop, restore: noop, setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop, rect: noop, clip: noop, moveTo: noop,
    lineTo: noop, arcTo: noop, arc: noop, roundRect: noop, drawImage: noop, createPattern: () => null, closePath: noop, fill: noop, stroke: noop,
    setLineDash: noop, translate: noop, rotate: noop,
    imageSmoothingEnabled: true, fillStyle: '#000', globalAlpha: 1, globalCompositeOperation: 'source-over', strokeStyle: '#000', lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', font: '', textAlign: 'start', textBaseline: 'alphabetic',
    fillText(text: string) {
      drawn.push({ text, fill: String(context.fillStyle) })
    },
  }
  return { context: context as unknown as DrawingContext, drawn }
}

function framed(): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 1, unit: 'beads' } })
  return withLayers(base, { frame: { ...frameOf(base)!, beads: { 0: { 0: '#1a1a1a', 1: '#f2c94c' } } } })
}

describe('Letters on the Frame (ticket 0573)', () => {
  const region = { x: 0, y: 0, width: 200, height: 100 }

  it('prints each painted bead\'s letter, white on a dark bead and ink on a light one, and none on an empty bead', () => {
    const project = framed()
    const { context, drawn } = recordingContext()
    renderProject(context, { project, space: spaceOf(project, false), region, zoom: 1, rowMarks: false, letters: { '#1a1a1a': 'A', '#f2c94c': 'D' } })
    expect(drawn).toEqual([
      { text: 'A', fill: LETTER_ON_DARK },
      { text: 'D', fill: LETTER_ON_LIGHT },
    ])
  })

  it('prints nothing when Letters is off', () => {
    const project = framed()
    const { context, drawn } = recordingContext()
    renderProject(context, { project, space: spaceOf(project, false), region, zoom: 1, rowMarks: false })
    expect(drawn).toEqual([])
  })

  it('chooses the letter color against the faded color of a finished bead', () => {
    const { context, drawn } = recordingContext()
    drawBeadLetter(context, { x: 0, y: 0, size: 20, color: '#1a1a1a', letter: 'A', dimmed: true, theme: LIGHT_THEME })
    expect(drawn).toEqual([{ text: 'A', fill: LETTER_ON_DARK }])
  })
})

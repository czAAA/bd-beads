import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import type { Project } from '../domain/project'
import { drawBeadLetter, LETTER_ON_DARK, LETTER_ON_LIGHT, LIGHT_THEME, type DrawingContext } from './beadLook'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import { frameOf, withCanvas } from '../domain/layerRecord'
import { rotateFrame } from '../domain/rotate'
import { withLayers } from '../testUtils/layerFields'

/** A context that records the text drawn and the color it was drawn in. */
function recordingContext() {
  const drawn: { text: string; fill: string }[] = []
  const noop = () => undefined
  const context: Record<string, unknown> & { fillStyle: unknown } = {
    save: noop, restore: noop, setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop, rect: noop, clip: noop, moveTo: noop,
    lineTo: noop, arcTo: noop, arc: noop, roundRect: noop, drawImage: noop, createPattern: () => null, closePath: noop, fill: noop, stroke: noop,
    setLineDash: noop, translate: noop, rotate: noop, transform: noop, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
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

/** A context that keeps its transform as a canvas does, and records how each letter is turned and mirrored on screen. */
function turningContext() {
  type Matrix = [number, number, number, number, number, number]
  let matrix: Matrix = [1, 0, 0, 1, 0, 0]
  const kept: Matrix[] = []
  const times = ([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix): Matrix => [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ]
  const letters: { text: string; degrees: number; mirrored: boolean }[] = []
  const { context: base } = recordingContext()
  const context = Object.assign(base, {
    save: () => kept.push(matrix),
    restore: () => (matrix = kept.pop() ?? matrix),
    setTransform: (...m: Matrix) => (matrix = m),
    transform: (...m: Matrix) => (matrix = times(matrix, m)),
    translate: (x: number, y: number) => (matrix = times(matrix, [1, 0, 0, 1, x, y])),
    rotate: (angle: number) => (matrix = times(matrix, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0])),
    scale: (x: number, y: number) => (matrix = times(matrix, [x, 0, 0, y, 0, 0])),
    getTransform: () => ({ a: matrix[0], b: matrix[1], c: matrix[2], d: matrix[3], e: matrix[4], f: matrix[5] }),
    fillText: (text: string) => {
      const [a, b, c, d] = matrix
      letters.push({ text, degrees: Math.round((Math.atan2(b, a) * 180) / Math.PI) + 0, mirrored: a * d - b * c < 0 })
    },
  })
  return { context: context as unknown as DrawingContext, letters }
}

describe('a letter reads upright however the Frame or the Canvas is turned (ticket 0728)', () => {
  const region = { x: 0, y: 0, width: 200, height: 200 }
  // The letters in view, each with how it is turned and whether it is mirrored on screen.
  const lettered = (project: Project) => {
    const { context, letters } = turningContext()
    const swatches = { '#1a1a1a': 'A', '#f2c94c': 'D' }
    renderProject(context, { project, space: spaceOf(project, true), region, zoom: 2, pixelRatio: 2, rowMarks: false, letters: swatches })
    return letters
  }
  const upright = (letters: ReturnType<typeof lettered>) => letters.length > 0 && letters.every(({ degrees, mirrored }) => degrees === 0 && !mirrored)

  it.each([90, 180, 270])('after Rotate canvas to %i°', (orientation) => {
    expect(upright(lettered(withCanvas(framed(), { orientation })))).toBe(true)
  })

  it.each([1, 2, 3])('after Rotate Frame %i times, on an upright and a turned Canvas', (turns) => {
    let project = framed()
    for (let turn = 0; turn < turns; turn += 1) project = rotateFrame(project)!
    expect(upright(lettered(project))).toBe(true)
    expect(upright(lettered(withCanvas(project, { orientation: 90 })))).toBe(true)
  })

  it('on its own, under a turn or a mirror the context is drawn at', () => {
    const { context, letters } = turningContext()
    const letter = () => drawBeadLetter(context, { x: 0, y: 0, size: 20, color: '#1a1a1a', letter: 'A', dimmed: false, theme: LIGHT_THEME })
    context.rotate(Math.PI)
    letter()
    context.scale(-1, 1)
    letter()
    expect(letters).toEqual([
      { text: 'A', degrees: 0, mirrored: false },
      { text: 'A', degrees: 0, mirrored: false },
    ])
  })
})

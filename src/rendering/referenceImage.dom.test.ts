import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { canvasOf } from '../domain/layerRecord'
import { weaveOf } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import { canvasBlits, recordingContext } from '../testUtils/recordingContext'
import { withLayers } from '../testUtils/layerFields'
import { PROJECT_THEMES, type BeadShape } from './beadLook'
import { renderProject } from './projectRenderer'
import { referenceBoxPx, referenceWidthLimits, type DrawnReference } from './referenceImage'
import { spaceOf } from './space'

/** A 3 × 2 Frame at row 2, column 2, its first row painted and its second left empty, and a bead on the Canvas. */
function framedProject(): Project {
  const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
  const cells = [0, 1, 2].map((column) => ({ row: 0, column, color: '#e63746' }))
  const frame = { ...weaveOf(canvasOf(project)), row: 2, column: 2, rows: 2, columns: 3, beads: withColors({}, cells) }
  return withLayers(project, { beads: withColors({}, [{ row: 0, column: 0, color: '#1a1a1a' }]), frame })
}

const picture = { width: 10, height: 5 } as unknown as CanvasImageSource
const reference: DrawnReference = { image: picture, place: { x: 60, y: 50, width: 100, angle: 90 }, height: 50, opacity: 50 }

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recordingContext().context as unknown as CanvasRenderingContext2D)
})
afterEach(() => {
  vi.restoreAllMocks()
})

function render(project: Project, extra: { open?: boolean; reference?: DrawnReference; frameTheme?: typeof PROJECT_THEMES.light } = {}) {
  const { context, calls } = recordingContext()
  const beads: BeadShape[] = []
  renderProject(context, {
    project,
    space: spaceOf(project, extra.open ?? true),
    region: { x: 0, y: 0, width: 400, height: 400 },
    zoom: 1,
    opaque: true,
    frameTheme: extra.frameTheme,
    reference: extra.reference,
    drawBead: (_context, bead) => {
      beads.push(bead)
      calls.push({ name: 'bead', args: [bead.color], fillStyle: undefined, strokeStyle: undefined, globalAlpha: 1 })
    },
  })
  return { calls, beads }
}

const isPicture = (call: { name: string; args: unknown[] }) => call.name === 'drawImage' && call.args[0] === picture

describe('the reference image on the Canvas (ReferenceImage card, ticket 0790)', () => {
  it('is drawn over the Canvas\'s Background, before its Position marks and every bead, at its opacity and turn', () => {
    const { calls } = render(framedProject(), { reference })
    const at = calls.findIndex(isPicture)
    const background = calls.findIndex((call) => call.name === 'fillRect' && call.fillStyle === PROJECT_THEMES.light.canvas)
    const marks = calls.findIndex((call) => call.name === 'fillRect' && typeof call.fillStyle === 'object')
    const firstBead = calls.findIndex((call) => call.name === 'bead')
    expect(background).toBeLessThan(at)
    expect(at).toBeLessThan(marks)
    expect(at).toBeLessThan(firstBead)
    expect(calls[at]!.globalAlpha).toBe(0.5)
    expect(calls[at]!.args.slice(1)).toEqual([-50, -25, 100, 50])
    expect(calls.slice(0, at).filter((call) => call.name === 'rotate').at(-1)!.args).toEqual([Math.PI / 2])
  })

  it('is drawn again over the Frame\'s own Background, cut to the Frame\'s box', () => {
    const { calls } = render(framedProject(), { reference, frameTheme: PROJECT_THEMES.dark })
    expect(calls.filter(isPicture)).toHaveLength(2)
  })

  it('leaves the Frame\'s empty beads to show it through, and draws the painted ones as they are', () => {
    const { beads } = render(framedProject(), { reference })
    expect(beads).toHaveLength(3)
    expect(beads.every((bead) => bead.color !== null)).toBe(true)
  })

  it('keeps the Frame\'s empty beads and the outlines under it, where with none shown they are tonal tiles (ticket 1001)', () => {
    expect(canvasBlits(render(framedProject(), { reference }).calls)).toBe(0)
    const without = render(framedProject())
    expect(without.beads.filter((bead) => bead.color === null)).toHaveLength(0)
    expect(canvasBlits(without.calls)).toBe(3)
  })

  it('is never drawn where none is handed in, nor in the Frame on its own', () => {
    expect(render(framedProject()).calls.some(isPicture)).toBe(false)
    expect(render(framedProject(), { reference, open: false }).calls.some(isPicture)).toBe(false)
  })
})

describe('the Canvas\'s box a new picture is fitted inside', () => {
  it('takes in the Canvas\'s beads and the Frame', () => {
    // A cube bead is 20 grid px: the Canvas bead at row 0, column 0 and the Frame to row 3, column 4.
    expect(referenceBoxPx(framedProject())).toEqual({ x: 0, y: 0, width: 100, height: 80 })
  })

  it('is the part in view on an empty Canvas without a Frame', () => {
    const empty = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
    expect(referenceBoxPx(empty, { row: 1, column: 2, rows: 3, columns: 4 })).toEqual({ x: 40, y: 20, width: 80, height: 60 })
  })

  it('lets the picture be no narrower than 4 beads and no wider than ten times the box', () => {
    expect(referenceWidthLimits(framedProject(), { x: 0, y: 0, width: 100, height: 80 })).toEqual({ min: 80, max: 1000 })
  })
})

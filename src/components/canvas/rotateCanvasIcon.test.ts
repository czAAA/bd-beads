import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, type Bead } from '../../domain/beads'
import { replaceBead } from '../../domain/projectBead'
import { bareProject } from '../../testUtils/layerFields'
import { ICON_NAMES } from '../ui/icons'
import { rotateCanvasIcon } from './rotateCanvasIcon'

const ofType = (formFactorId: string) => BEAD_CATALOG.filter((bead) => bead.formFactor.id === formFactorId)
const onCanvas = (bead: Bead) => bareProject({ beadId: bead.id, bead })

describe('the Rotate canvas icon (ticket 1082)', () => {
  it.each(['round', 'delica', 'cube'])('draws a %s Bead the same in every size and Brand', (type) => {
    const icons = new Set(ofType(type).map((bead) => rotateCanvasIcon(onCanvas(bead))))
    expect([...icons]).toEqual([`rotate-canvas-${type}`])
  })

  it("goes by the Frame's Bead when a Frame is set, and by the Canvas's otherwise", () => {
    const [cube, delica] = [ofType('cube')[0]!, ofType('delica')[0]!]
    const framed = bareProject({ beadId: cube.id, bead: cube, frame: { technique: 'loom', row: 0, column: 0, rows: 4, columns: 4, beads: {} } })
    expect(rotateCanvasIcon(framed)).toBe('rotate-canvas-cube')
    expect(rotateCanvasIcon(replaceBead(framed, delica, undefined, 'frame'))).toBe('rotate-canvas-delica')
    expect(rotateCanvasIcon(replaceBead(framed, delica, undefined, 'canvas'))).toBe('rotate-canvas-cube')
  })

  it('keeps the plain rotate-canvas icon for a Bead whose Form factor has no drawing', () => {
    const round = ofType('round')[0]!
    const bugle = { ...round, id: 'toho/bugle/3mm', formFactor: { ...round.formFactor, id: 'bugle', nameKey: 'bugle' } }
    expect(rotateCanvasIcon(onCanvas(bugle))).toBe('rotate-canvas')
    expect(rotateCanvasIcon(bareProject({ beadId: 'nobody/knows/1', bead: undefined }))).toBe('rotate-canvas')
  })

  it('has a drawing for every Form factor in the catalog, so a new Type cannot ship without its icon', () => {
    const formFactors = new Set(BEAD_CATALOG.map((bead) => bead.formFactor.id))
    for (const id of formFactors) expect(ICON_NAMES, `the ${id} Form factor has no rotate-canvas-${id} icon`).toContain(`rotate-canvas-${id}`)
  })
})
